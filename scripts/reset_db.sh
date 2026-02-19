#!/bin/bash
# Borra todos los items de todas las tablas clínicas y crea el superusuario platform_admin
set -e

PROFILE="aski"
REGION="us-east-1"
TABLES=("clinical-users" "clinical-appointments" "clinical-patients" "clinical-consents" "clinical-odontograms" "clinical-treatment-plans")

echo "=== Limpiando tablas DynamoDB ==="

for TABLE in "${TABLES[@]}"; do
  echo "→ Escaneando $TABLE..."
  ITEMS=$(aws dynamodb scan \
    --table-name "$TABLE" \
    --attributes-to-get PK SK \
    --query "Items" \
    --output json \
    --profile "$PROFILE" \
    --region "$REGION")

  COUNT=$(echo "$ITEMS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  echo "  $COUNT items encontrados"

  if [ "$COUNT" -gt 0 ]; then
    echo "$ITEMS" | python3 -c "
import sys, json, subprocess

items = json.load(sys.stdin)
# Batch delete in groups of 25
for i in range(0, len(items), 25):
    batch = items[i:i+25]
    requests = [{'DeleteRequest': {'Key': {'PK': item['PK'], 'SK': item['SK']}}} for item in batch]
    payload = json.dumps({'$TABLE': requests})
    result = subprocess.run(
        ['aws', 'dynamodb', 'batch-write-item',
         '--request-items', payload,
         '--profile', '$PROFILE',
         '--region', '$REGION'],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print('ERROR:', result.stderr)
    else:
        print(f'  Deleted batch of {len(batch)}')
"
  fi
  echo "  ✓ $TABLE limpiada"
done

echo ""
echo "=== Todas las tablas limpiadas ==="
