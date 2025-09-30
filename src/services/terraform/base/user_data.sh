#!/bin/bash
set -e
exec > >(tee -i /var/log/user_data.log)
exec 2>&1

# --- Fetch EC2 metadata ---
TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)

domain_name="${user_domain}-dfm.cloud.dfmanager.com"
nifi_0_domain="${user_domain}-nifi-0.cloud.dfmanager.com"
nifi_1_domain="${user_domain}-nifi-1.cloud.dfmanager.com"
NIFI_ADMIN_USER="${nifi_user}"
NIFI_ADMIN_PASS="${nifi_pass}"
NIFI_REGISTRY_URL="http://localhost:18080"


# --- Helper to update env/properties ---
update_env_var() {
  local key="$1"
  local value="$2"
  local file="$3"
  if grep -q "^$${key}=" "$file"; then
    sed -i "s|^$${key}=.*|$${key}=$${value}|" "$file"
  else
    echo "$${key}=$${value}" >> "$file"
  fi
}

# --- Stop services before Certbot ---
systemctl stop dfm || true
systemctl stop nginx || true
systemctl stop nifi-0 || true
systemctl stop nifi-1 || true

# --- Request SSL certs ---
for d in "$domain_name" "$nifi_0_domain" "$nifi_1_domain"; do
  echo "==> Requesting SSL certificate for $d"
  certbot certonly --standalone -d "$d" --non-interactive --agree-tos -m admin@"$d"
done

# --- Secure permissions ---
usermod -a -G ssl-cert dfm || true
usermod -a -G ssl-cert nifi || true
chmod 755 /etc/letsencrypt/live /etc/letsencrypt/archive || true
for d in "$domain_name" "$nifi_0_domain" "$nifi_1_domain"; do
  chgrp -R ssl-cert "/etc/letsencrypt/live/$d" "/etc/letsencrypt/archive/$d" || true
  find "/etc/letsencrypt/live/$d" -type d -exec chmod 750 {} + || true
  find "/etc/letsencrypt/archive/$d" -type d -exec chmod 750 {} + || true
  find "/etc/letsencrypt/live/$d" -type f -exec chmod 640 {} + || true
  find "/etc/letsencrypt/archive/$d" -type f -exec chmod 640 {} + || true
done

# --- Configure DFM ---
CERT_PATH="/etc/letsencrypt/live/$domain_name/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/$domain_name/privkey.pem"

update_env_var "BASE_URL" "https://$domain_name:8443" "/opt/dfm/.env"
update_env_var "SSL_ENABLED" "true" "/opt/dfm/.env"
update_env_var "SSL_CERT_PATH" "$CERT_PATH" "/opt/dfm/.env"
update_env_var "SSL_KEY_PATH" "$KEY_PATH" "/opt/dfm/.env"

systemctl restart dfm

# --- Function: create keystore & truststore and configure NiFi ---
configure_nifi_ssl() {
  local DOMAIN=$1         # FQDN for proxy
  local HOME=$2           # NiFi home
  local HTTPS_PORT=$3
  local PASSWORD="changeit"
  local CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
  local CONF_FILE="$HOME/conf/nifi.properties"

  # --- Create keystore & truststore ---
  openssl pkcs12 -export \
    -in "$CERT_DIR/fullchain.pem" \
    -inkey "$CERT_DIR/privkey.pem" \
    -out "$HOME/keystore.p12" \
    -name nifi-key \
    -password pass:$PASSWORD

  keytool -import -trustcacerts \
    -alias nifi-ca \
    -file "$CERT_DIR/fullchain.pem" \
    -keystore "$HOME/truststore.jks" \
    -storepass $PASSWORD \
    -noprompt

  chown nifi:nifi "$HOME/keystore.p12" "$HOME/truststore.jks"
  chmod 640 "$HOME/keystore.p12" "$HOME/truststore.jks"

  # --- Configure nifi.properties ---
  # Uncomment HTTPS lines and set host/port
  sed -i "s|^#nifi.web.https.host=.*|nifi.web.https.host=0.0.0.0|" "$CONF_FILE"
  sed -i "s|^#nifi.web.https.port=.*|nifi.web.https.port=$HTTPS_PORT|" "$CONF_FILE"

  # Comment out HTTP lines
  sed -i "s|^nifi.web.http.host=.*|#&|" "$CONF_FILE"
  sed -i "s|^nifi.web.http.port=.*|#&|" "$CONF_FILE"

  # Disable HTTP remote input
  sed -i "s|^nifi.remote.input.http.enabled=.*|nifi.remote.input.http.enabled=false|" "$CONF_FILE"

  # Set proxy host with port
  if grep -q "^nifi.web.proxy.host=" "$CONF_FILE"; then
    sed -i "s|^nifi.web.proxy.host=.*|nifi.web.proxy.host=$DOMAIN:$HTTPS_PORT|" "$CONF_FILE"
  else
    echo "nifi.web.proxy.host=$DOMAIN:$HTTPS_PORT" >> "$CONF_FILE"
  fi

  # Keystore/truststore settings
  update_env_var "nifi.security.keystore" "$HOME/keystore.p12" "$CONF_FILE"
  update_env_var "nifi.security.keystoreType" "PKCS12" "$CONF_FILE"
  update_env_var "nifi.security.keystorePasswd" "$PASSWORD" "$CONF_FILE"
  update_env_var "nifi.security.keyPasswd" "$PASSWORD" "$CONF_FILE"
  update_env_var "nifi.security.truststore" "$HOME/truststore.jks" "$CONF_FILE"
  update_env_var "nifi.security.truststoreType" "JKS" "$CONF_FILE"
  update_env_var "nifi.security.truststorePasswd" "$PASSWORD" "$CONF_FILE"
}

# --- Apply SSL config for NiFi instances ---
configure_nifi_ssl "$nifi_0_domain" "/opt/nifi-0" 9443
configure_nifi_ssl "$nifi_1_domain" "/opt/nifi-1" 9445

# --- Configure Nifi Access ---

/opt/nifi-0/bin/nifi.sh set-single-user-credentials admin adminpass1234
/opt/nifi-1/bin/nifi.sh set-single-user-credentials admin adminpass1234


# --- Configure Nifi Registry Access ---
configure_nifi_registry() {
  local HOME=$1
  local CONF_FILE="$HOME/conf/nifi.properties"

  if grep -q "^nifi.registry.client.url=" "$CONF_FILE"; then
    sed -i "s|^nifi.registry.client.url=.*|nifi.registry.client.url=$NIFI_REGISTRY_URL|" "$CONF_FILE"
  else
    echo "nifi.registry.client.url=$NIFI_REGISTRY_URL" >> "$CONF_FILE"
  fi
}

# --- Assign Nifi Registry Access ---
configure_nifi_registry "/opt/nifi-0"
configure_nifi_registry "/opt/nifi-1"

# Restart services
systemctl restart nifi-0
systemctl restart nifi-1
systemctl restart dfm

echo "==> Setup complete: SSL + proxy + renewal hooks installed"