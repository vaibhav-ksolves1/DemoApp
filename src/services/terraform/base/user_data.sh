#!/bin/bash
set -e
exec > >(tee -i /var/log/user_data.log)
exec 2>&1

# --- Fetch EC2 metadata ---
TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4)

# --- Domain configuration ---
domain_name="${user_domain}-dfm.cloud.dfmanager.com"
nifi_0_domain="${user_domain}-nifi-0.cloud.dfmanager.com"
nifi_1_domain="${user_domain}-nifi-1.cloud.dfmanager.com"
nifi_registry_domain="${user_domain}-nifi-registry.cloud.dfmanager.com"
NIFI_API_0="https://$nifi_0_domain:9443/nifi-api"
NIFI_API_1="https://$nifi_1_domain:9445/nifi-api"
REGISTRY_URL="http://$nifi_registry_domain:18443"

# --- NiFi credentials ---
NIFI_USER="${nifi_user}"
NIFI_PASS="${nifi_pass}"

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
systemctl daemon-reload
systemctl stop dfm || true
systemctl stop nginx || true
systemctl stop nifi-0 || true
systemctl stop nifi-1 || true
systemctl stop nifi-registry || true

# --- Request SSL certs for all services ---
for d in "$domain_name" "$nifi_0_domain" "$nifi_1_domain" "$nifi_registry_domain"; do
  echo "==> Requesting SSL certificate for $d"
  certbot certonly --standalone --cert-name cloud.dfmanager.com -d "$d" --non-interactive --agree-tos -m admin@"$d"
  
done

# --- Secure permissions ---
usermod -a -G ssl-cert dfm || true
usermod -a -G ssl-cert nifi || true
chmod 755 /etc/letsencrypt/live /etc/letsencrypt/archive || true
for d in "$domain_name" "$nifi_0_domain" "$nifi_1_domain" "$nifi_registry_domain"; do
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
  local DOMAIN=$1
  local HOME=$2
  local HTTPS_PORT=$3
  local PASSWORD=$4
  local CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
  local CONF_FILE="$HOME/conf/nifi.properties"

  # Create keystore & truststore
  openssl pkcs12 -export \
    -in "$CERT_DIR/fullchain.pem" \
    -inkey "$CERT_DIR/privkey.pem" \
    -out "$HOME/keystore.p12" \
    -name nifi-key \
    -password pass:$${PASSWORD}

  keytool -import -trustcacerts \
    -alias nifi-ca \
    -file "$CERT_DIR/fullchain.pem" \
    -keystore "$HOME/truststore.jks" \
    -storepass $${PASSWORD} \
    -noprompt

  chown nifi:nifi "$HOME/keystore.p12" "$HOME/truststore.jks"
  chmod 640 "$HOME/keystore.p12" "$HOME/truststore.jks"

  # Configure nifi.properties
  sed -i "s|^nifi.web.https.host=.*|nifi.web.https.host=0.0.0.0|" "$CONF_FILE"
  sed -i "s|^nifi.web.https.port=.*|nifi.web.https.port=$HTTPS_PORT|" "$CONF_FILE"
  # sed -i "s|^nifi.web.http.host=.*|#&|" "$CONF_FILE"
  # sed -i "s|^nifi.web.http.port=.*|#&|" "$CONF_FILE"
  sed -i "s|^nifi.remote.input.http.enabled=.*|nifi.remote.input.http.enabled=false|" "$CONF_FILE"

  # Proxy host with port
  if grep -q "^nifi.web.proxy.host=" "$CONF_FILE"; then
    sed -i "s|^nifi.web.proxy.host=.*|nifi.web.proxy.host=$DOMAIN:$HTTPS_PORT|" "$CONF_FILE"
  else
    echo "nifi.web.proxy.host=$DOMAIN:$HTTPS_PORT" >> "$CONF_FILE"
  fi

  # Keystore/truststore settings
  update_env_var "nifi.security.keystore" "$HOME/keystore.p12" "$CONF_FILE"
  update_env_var "nifi.security.keystoreType" "PKCS12" "$CONF_FILE"
  update_env_var "nifi.security.keystorePasswd" "$${PASSWORD}" "$CONF_FILE"
  update_env_var "nifi.security.keyPasswd" "$${PASSWORD}" "$CONF_FILE"
  update_env_var "nifi.security.truststore" "$HOME/truststore.jks" "$CONF_FILE"
  update_env_var "nifi.security.truststoreType" "JKS" "$CONF_FILE"
  update_env_var "nifi.security.truststorePasswd" "$${PASSWORD}" "$CONF_FILE"

  # Set single-user credentials
  $HOME/bin/nifi.sh set-single-user-credentials "$NIFI_USER" "$NIFI_PASS"
}

# --- Apply SSL and credentials for NiFi nodes ---
configure_nifi_ssl "$nifi_0_domain" "/opt/nifi-0" 9443 "$NIFI_PASS"
configure_nifi_ssl "$nifi_1_domain" "/opt/nifi-1" 9445 "$NIFI_PASS"

# --- Configure NiFi Registry SSL ---
echo "==> Configuring NiFi Registry SSL certificates"
configure_nifi_registry_ssl() {
  local DOMAIN=$1
  local HOME=$2
  local PASSWORD=$3
  local CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
  local CONF_FILE="$HOME/conf/nifi-registry.properties"

  openssl pkcs12 -export \
    -in "$CERT_DIR/fullchain.pem" \
    -inkey "$CERT_DIR/privkey.pem" \
    -out "$HOME/keystore.p12" \
    -name registry-key \
    -password pass:$PASSWORD

  keytool -import -trustcacerts \
    -alias registry-ca \
    -file "$CERT_DIR/fullchain.pem" \
    -keystore "$HOME/truststore.jks" \
    -storepass $PASSWORD \
    -noprompt

  chown nifi:nifi "$HOME/keystore.p12" "$HOME/truststore.jks"
  chmod 640 "$HOME/keystore.p12" "$HOME/truststore.jks"

  # Disable HTTP and enable HTTPS
  update_env_var "nifi.registry.web.https.host" "" "$CONF_FILE"
  update_env_var "nifi.registry.web.https.port" "" "$CONF_FILE"
  update_env_var "nifi.registry.web.http.host" "0.0.0.0" "$CONF_FILE"
  update_env_var "nifi.registry.web.http.port" "18443" "$CONF_FILE"
  
  # SSL Configuration
  # update_env_var "nifi.registry.security.keystore" "$HOME/keystore.p12" "$CONF_FILE"
  # update_env_var "nifi.registry.security.keystoreType" "PKCS12" "$CONF_FILE"
  # update_env_var "nifi.registry.security.keystorePasswd" "$PASSWORD" "$CONF_FILE"
  # update_env_var "nifi.registry.security.keyPasswd" "$PASSWORD" "$CONF_FILE"
  # update_env_var "nifi.registry.security.truststore" "$HOME/truststore.jks" "$CONF_FILE"
  # update_env_var "nifi.registry.security.truststoreType" "JKS" "$CONF_FILE"
  # update_env_var "nifi.registry.security.truststorePasswd" "$PASSWORD" "$CONF_FILE"
  
  # Additional SSL settings for proper certificate handling
  update_env_var "nifi.registry.security.needClientAuth" "false" "$CONF_FILE"
  # update_env_var "nifi.registry.security.authorizer" "managed-authorizer" "$CONF_FILE"
  
  # Ensure HTTP is completely disabled
  # sed -i "s|^nifi.registry.web.http.host=.*|nifi.registry.web.http.host=|" "$CONF_FILE"
  # sed -i "s|^nifi.registry.web.http.port=.*|nifi.registry.web.http.port=|" "$CONF_FILE"
}

# --- Apply SSL to NiFi Registry ---
configure_nifi_registry_ssl "$nifi_registry_domain" "/opt/nifi-registry" "$NIFI_PASS"

# Basic certificate check
echo "[ssl-check] Verifying certificates exist"
for d in "$domain_name" "$nifi_0_domain" "$nifi_1_domain" "$nifi_registry_domain"; do
  if [ -f "/etc/letsencrypt/live/$d/fullchain.pem" ]; then
    echo "[ssl-check] Certificate OK for $d"
  else
    echo "[ssl-check] ERROR: Certificate missing for $d"
  fi
done

# --- Configure NiFi nodes to connect securely to Registry ---
echo "==> Configuring NiFi nodes to connect securely to Registry"
configure_nifi_registry_client_ssl() {
  local NIFI_HOME=$1
  local REGISTRY_DOMAIN=$2
  local HTTPS_PORT=$3
  local PASSWORD=$4
  local CONF_FILE="$NIFI_HOME/conf/nifi.properties"
  local REGISTRY_URL="http://$REGISTRY_DOMAIN:$HTTPS_PORT"

  # Import Registry cert into NiFi truststore
  keytool -import -trustcacerts -alias registry-ca \
    -file "/etc/letsencrypt/live/$REGISTRY_DOMAIN/fullchain.pem" \
    -keystore "$NIFI_HOME/truststore.jks" -storepass "$PASSWORD" -noprompt

  update_env_var "nifi.registry.client.url" "$REGISTRY_URL" "$CONF_FILE"
  update_env_var "nifi.registry.client.truststore" "$NIFI_HOME/truststore.jks" "$CONF_FILE"
  update_env_var "nifi.registry.client.truststoreType" "JKS" "$CONF_FILE"
  update_env_var "nifi.registry.client.truststorePasswd" "$PASSWORD" "$CONF_FILE"
}

configure_nifi_registry_client_ssl "/opt/nifi-0" "$nifi_registry_domain" 18443 "$NIFI_PASS"
configure_nifi_registry_client_ssl "/opt/nifi-1" "$nifi_registry_domain" 18443 "$NIFI_PASS"

# --- Restart NiFi nodes ---
echo "==> Restarting NiFi nodes"
systemctl daemon-reload
systemctl restart nifi-0
systemctl restart nifi-1

echo "==> Restarting NiFi Registry with SSL configuration"
systemctl restart nifi-registry
sleep 10

# Verify registry is running and accessible
echo "[registry-check] Verifying registry service status"
systemctl status nifi-registry --no-pager -l | head -10 || echo "[registry-check] Service status check failed"

# echo "[registry-check] Testing registry SSL connectivity"
# curl -k -s -o /dev/null --connect-timeout 10 --max-time 15 -w "HTTP Code: %%{http_code}\n" "http://$nifi_registry_domain:18443/nifi-registry" || echo "[registry-check] Registry SSL test failed"

# Basic SSL check
# echo "[ssl-check] Testing certificate validity:"
# openssl x509 -in "/etc/letsencrypt/live/$nifi_registry_domain/fullchain.pem" -text -noout | grep -E "(Subject:|Not After)" || echo "[ssl-check] Certificate check failed"
# # 
# sleep 10

# --- Configure NiFi nodes to connect securely to Registry via API ---
echo "==> Configuring NiFi nodes to connect securely to Registry via API"
configure_nifi_registry_api() {
  local NIFI_API="$1"
  local REGISTRY_URL="$2/nifi-registry"
  local USER="$3"
  local PASS="$4"
  local HOME="$5"

  echo "[nifi-api] Fetching access token from $${NIFI_API}"
  TOKEN=$(curl -sS -k --connect-timeout 5 --max-time 20 --retry 5 --retry-delay 2 --retry-connrefused -X POST \
    -d "username=$${USER}&password=$${PASS}" \
    "$${NIFI_API}/access/token" || true)

  if [ -z "$TOKEN" ]; then
    echo "[nifi-api] ERROR: Failed to obtain access token from $${NIFI_API}"
    return 1
  fi

  # Try registry client creation with token auth
  echo "[nifi-api] Attempting to create Registry Client pointing to $${REGISTRY_URL}"
  REG_CLIENTS_EP="$${NIFI_API}/controller/registry-clients"
  
  curl -sS -k --fail --connect-timeout 5 --max-time 30 -X POST "$REG_CLIENTS_EP" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"component\":{\"name\":\"MainRegistry\",\"uri\":\"$${REGISTRY_URL}\"},\"revision\":{\"version\":0}}" \
    && echo "[nifi-api] Registry client created successfully" \
    || echo "[nifi-api] WARN: Registry client creation failed"

  # Create SSL Context Controller Service
  # echo "[nifi-api] Creating SSL Context Controller Service"
  # curl -sS -k --fail --connect-timeout 5 --max-time 30 -X POST "$${NIFI_API}/process-groups/root/controller-services" \
  #   -H "Authorization: Bearer $TOKEN" \
  #   -H 'Content-Type: application/json' \
  #   -d "{\"component\":{\"name\":\"RegistrySSLContext\",\"type\":\"org.apache.nifi.ssl.StandardRestrictedSSLContextService\",\"parentGroupId\":\"root\",\"properties\":{\"Keystore Filename\":\"$HOME/keystore.p12\",\"Keystore Type\":\"PKCS12\",\"Keystore Password\":\"$PASS\",\"key-password\":\"$PASS\",\"Truststore Filename\":\"$HOME/truststore.jks\",\"Truststore Type\":\"JKS\",\"Truststore Password\":\"$PASS\"}},\"revision\":{\"version\":0}}" \
  #   || echo "[nifi-api] WARN: Creating SSL context service may have failed (continuing)"
}

# Wait until NiFi API is ready
wait_for_nifi_api() {
  local NIFI_API="$1"
  local USER="$2"
  local PASS="$3"
  local MAX_ATTEMPTS=60
  local SLEEP_SECS=5
  echo "[nifi-api] Waiting for API readiness at $${NIFI_API}"
  
  for ((i=1; i<=MAX_ATTEMPTS; i++)); do
    HTTP_CODE=$(curl -k -s -o /dev/null --connect-timeout 5 --max-time 10 -w "%%{http_code}" "$${NIFI_API}/flow/about" || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      echo "[nifi-api] Ready (HTTP 200) - no auth required"
      return 0
    elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
      echo "[nifi-api] API requires authentication, getting token..."
      TOKEN=$(curl -sS -k --connect-timeout 5 --max-time 20 -X POST \
        -d "username=$${USER}&password=$${PASS}" \
        "$${NIFI_API}/access/token" || true)
      
      if [ -n "$TOKEN" ]; then
        AUTH_CODE=$(curl -k -s -o /dev/null --connect-timeout 5 --max-time 10 -w "%%{http_code}" \
          -H "Authorization: Bearer $TOKEN" \
          "$${NIFI_API}/flow/about" || echo "000")
        if [ "$AUTH_CODE" = "200" ]; then
          echo "[nifi-api] Ready (HTTP 200) - authenticated"
          return 0
        fi
      fi
    fi
    
    echo "[nifi-api] Attempt $i/$MAX_ATTEMPTS: not ready yet (HTTP $HTTP_CODE). Waiting $SLEEP_SECS s..."
    sleep "$SLEEP_SECS"
  done
  echo "[nifi-api] ERROR: API at $${NIFI_API} not ready after $((MAX_ATTEMPTS*SLEEP_SECS)) seconds"
  return 1
}

wait_for_nifi_api "$NIFI_API_0" "$NIFI_USER" "$NIFI_PASS"
wait_for_nifi_api "$NIFI_API_1" "$NIFI_USER" "$NIFI_PASS"

# Wait for NiFi Registry API to be ready
wait_for_registry_api() {
  local REGISTRY_URL="$1"
  local MAX_ATTEMPTS=20
  local SLEEP_SECS=5
  echo "[registry-api] Waiting for Registry API at $${REGISTRY_URL}"

  for ((i=1; i<=MAX_ATTEMPTS; i++)); do
    if ! systemctl is-active --quiet nifi-registry; then
      sleep "$SLEEP_SECS"
      continue
    fi
    
    HTTP_CODE=$(curl -k -s -o /dev/null --connect-timeout 5 --max-time 10 -w "%%{http_code}" "$${REGISTRY_URL}/nifi-registry-api/access/token" || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "405" ]; then
      echo "[registry-api] Ready (HTTP $HTTP_CODE)"
      return 0
    fi
    
    ALT_CODE=$(curl -k -s -o /dev/null --connect-timeout 5 --max-time 10 -w "%%{http_code}" "$${REGISTRY_URL}/nifi-registry-api/about" || echo "000")
    if [ "$ALT_CODE" = "200" ]; then
      echo "[registry-api] Ready via /about (HTTP $ALT_CODE)"
      return 0
    fi
    
    echo "[registry-api] Attempt $i/$MAX_ATTEMPTS: not ready (token: $HTTP_CODE, about: $ALT_CODE)"
    sleep "$SLEEP_SECS"
  done
  
  echo "[registry-api] ERROR: Registry API not ready after $((MAX_ATTEMPTS*SLEEP_SECS)) seconds"
  return 1
}

# Test NiFi Registry API with certificate authentication
# configure_registry_api_cert() {
#   local REGISTRY_URL="$1"
#   local PASS="$2"
  
#   HTTP_CODE=$(curl -k -s -o /dev/null --connect-timeout 5 --max-time 10 -w "%%{http_code}" \
#     --cert-type P12 --cert "/opt/nifi-registry/keystore.p12:$PASS" \
#     --cacert "/etc/letsencrypt/live/$nifi_registry_domain/fullchain.pem" \
#     "$REGISTRY_URL/nifi-registry-api/access/token" || echo "000")
    
#   if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "405" ]; then
#     echo "[registry-api] Certificate auth OK (HTTP $HTTP_CODE)"
#     return 0
#   else
#     echo "[registry-api] Certificate auth failed (HTTP $HTTP_CODE)"
#     return 1
#   fi
# }

# Try to wait for registry, but don't fail if it's not ready
# echo "==> Attempting to configure registry connections"
# if wait_for_registry_api "$REGISTRY_URL"; then
#   echo "[registry-api] Registry is ready, proceeding with API configuration"
  
#   # Test certificate authentication
#   configure_registry_api_cert "$REGISTRY_URL" "$NIFI_PASS"
  
configure_nifi_registry_api "$NIFI_API_0" "$REGISTRY_URL" "$NIFI_USER" "$NIFI_PASS" "/opt/nifi-registry"
configure_nifi_registry_api "$NIFI_API_1" "$REGISTRY_URL" "$NIFI_USER" "$NIFI_PASS" "/opt/nifi-registry"
# else
#   echo "[registry-api] WARN: Registry not ready, skipping API configuration"
# fi

# --- Restart all services ---
echo "==> Restarting all services"
systemctl restart dfm

echo "==> Setup complete: SSL + NiFi + Registry + single-user credentials + DFM configured"