#!/bin/bash
# Ejecutar después de cada sam deploy para restaurar configuración de API Gateway
# que SAM no gestiona correctamente (GatewayResponses CORS + UsagePlan stage link)

set -e

API_ID="ipv2henk5m"
STAGE="prod"
USAGE_PLAN_ID="0ak6v3"
API_KEY_ID="zn937hd17i"
REGION="us-east-1"
PROFILE="${AWS_PROFILE:-aloai}"

echo "==> Restaurando GatewayResponses CORS..."
for TYPE in DEFAULT_4XX DEFAULT_5XX INVALID_API_KEY ACCESS_DENIED UNAUTHORIZED; do
  aws apigateway put-gateway-response \
    --rest-api-id "$API_ID" \
    --response-type "$TYPE" \
    --response-parameters '{
      "gatewayresponse.header.Access-Control-Allow-Origin": "'"'"'*'"'"'",
      "gatewayresponse.header.Access-Control-Allow-Headers": "'"'"'Content-Type,Authorization,x-api-key'"'"'",
      "gatewayresponse.header.Access-Control-Allow-Methods": "'"'"'GET,POST,PUT,PATCH,DELETE,OPTIONS'"'"'"
    }' \
    --region "$REGION" --profile "$PROFILE" \
    --output text --query 'responseType'
done

echo "==> Eximiendo OPTIONS del API Key requirement (necesario para CORS preflight)..."
# SAM resetea apiKeyRequired=true en OPTIONS con cada deploy
# El browser nunca puede incluir x-api-key en un preflight, por eso OPTIONS debe ser libre
PROXY_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --profile "$PROFILE" --region "$REGION" --output json | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print([i['id'] for i in d['items'] if i.get('path')=='/{proxy+}'][0])")
WEBHOOK_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --profile "$PROFILE" --region "$REGION" --output json | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print([i['id'] for i in d['items'] if i.get('path')=='/public/whatsapp/webhook'][0])")

for RESOURCE_ID in "$PROXY_RESOURCE_ID" "$WEBHOOK_RESOURCE_ID"; do
  aws apigateway update-method \
    --rest-api-id "$API_ID" \
    --resource-id "$RESOURCE_ID" \
    --http-method OPTIONS \
    --patch-operations "op=replace,path=/apiKeyRequired,value=false" \
    --region "$REGION" --profile "$PROFILE" \
    --output text --query 'apiKeyRequired' 2>/dev/null || true
done

echo "==> Vinculando UsagePlan al stage $STAGE..."
aws apigateway update-usage-plan --usage-plan-id "$USAGE_PLAN_ID" \
  --patch-operations "op=add,path=/apiStages,value=${API_ID}:${STAGE}" \
  --region "$REGION" --profile "$PROFILE" \
  --output text --query 'apiStages[0].stage' 2>/dev/null || echo "   (ya vinculado)"

echo "==> Re-asociando API Key al UsagePlan..."
aws apigateway delete-usage-plan-key --usage-plan-id "$USAGE_PLAN_ID" \
  --key-id "$API_KEY_ID" \
  --region "$REGION" --profile "$PROFILE" 2>/dev/null || true
aws apigateway create-usage-plan-key --usage-plan-id "$USAGE_PLAN_ID" \
  --key-id "$API_KEY_ID" --key-type API_KEY \
  --region "$REGION" --profile "$PROFILE" \
  --output text --query 'name'

echo "==> Redeployando stage $STAGE..."
aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --stage-name "$STAGE" \
  --region "$REGION" --profile "$PROFILE" \
  --output text --query 'id'

echo "==> Verificando..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $(aws apigateway get-api-key --api-key $API_KEY_ID --include-value --region $REGION --profile $PROFILE --query value --output text)" \
  -d '{"email":"check@check.com","password":"check"}')

if [ "$STATUS" = "401" ]; then
  echo "✓ API Gateway operativo (401 = credenciales incorrectas, esperado)"
elif [ "$STATUS" = "403" ]; then
  echo "✗ Sigue con 403 - revisar manualmente"
  exit 1
else
  echo "✓ Respuesta HTTP: $STATUS"
fi
