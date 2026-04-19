#!/bin/bash
# Migra todas las tablas DynamoDB de la cuenta aski a la cuenta aloai.
# Requiere credenciales activas en ambos perfiles:
#   aws sso login --profile aski
#   aws sso login --profile aloai

set -e

SOURCE_PROFILE="${SOURCE_PROFILE:-aski}"
TARGET_PROFILE="${TARGET_PROFILE:-aloai}"
REGION="us-east-1"
TMP_DIR="/tmp/clinical-ddb-migration"

TABLES=(
  "clinical-users"
  "clinical-appointments"
  "clinical-patients"
  "clinical-consents"
  "clinical-consent-templates"
  "clinical-odontograms"
  "clinical-treatment-plans"
  "clinical-payments"
  "clinical-budgets"
)

mkdir -p "$TMP_DIR"

echo "=== Migración DynamoDB: $SOURCE_PROFILE → $TARGET_PROFILE ==="
echo ""

for TABLE in "${TABLES[@]}"; do
  SCAN_FILE="$TMP_DIR/${TABLE}.json"

  echo "→ Exportando $TABLE desde $SOURCE_PROFILE..."
  aws dynamodb scan \
    --table-name "$TABLE" \
    --profile "$SOURCE_PROFILE" \
    --region "$REGION" \
    --output json > "$SCAN_FILE"

  COUNT=$(python3 -c "import json,sys; d=json.load(open('$SCAN_FILE')); print(d.get('Count',0))")
  echo "  $COUNT ítems encontrados"

  if [ "$COUNT" -eq 0 ]; then
    echo "  (vacía, omitiendo)"
    continue
  fi

  echo "  Importando en $TARGET_PROFILE..."
  # Procesar en batches de 25 (límite de batch-write-item)
  python3 -c "
import json, subprocess, sys

with open('$SCAN_FILE') as f:
    items = json.load(f).get('Items', [])

table = '$TABLE'
profile = '$TARGET_PROFILE'
region = '$REGION'
batch_size = 25

for i in range(0, len(items), batch_size):
    batch = items[i:i+batch_size]
    payload = json.dumps({table: [{'PutRequest': {'Item': item}} for item in batch]})
    result = subprocess.run(
        ['aws', 'dynamodb', 'batch-write-item',
         '--request-items', payload,
         '--profile', profile,
         '--region', region],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f'ERROR en batch {i//batch_size + 1}: {result.stderr}', file=sys.stderr)
        sys.exit(1)
    unprocessed = json.loads(result.stdout).get('UnprocessedItems', {})
    if unprocessed:
        print(f'  WARN: {len(unprocessed.get(table,[]))} ítems sin procesar en batch {i//batch_size + 1}')
    else:
        print(f'  Batch {i//batch_size + 1}: {len(batch)} ítems OK')
"

  echo "  ✓ $TABLE migrada"
  echo ""
done

echo "=== Migración completada ==="
echo "Archivos temporales en: $TMP_DIR"
