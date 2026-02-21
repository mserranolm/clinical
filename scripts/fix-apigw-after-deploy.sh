#!/bin/bash
# Ejecutar después de cada sam deploy para restaurar configuración de API Gateway
# que SAM no gestiona correctamente (GatewayResponses CORS + UsagePlan stage link)

set -e

API_ID="egsnzyxipf"
STAGE="prod"
USAGE_PLAN_ID="8gsc3l"
API_KEY_ID="pjdbiyrum2"
REGION="us-east-1"
PROFILE="${AWS_PROFILE:-aski}"

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
