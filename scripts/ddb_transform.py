#!/usr/bin/env python3
"""Convierte output de 'aws dynamodb scan' a formato batch-write-item."""
import json
import sys

def transform(scan_file: str) -> None:
    with open(scan_file) as f:
        data = json.load(f)

    items = data.get("Items", [])
    if not items:
        print("{}", file=sys.stderr)
        sys.exit(0)

    # Extraer nombre de tabla del argumento o del primer item
    table_name = sys.argv[2] if len(sys.argv) > 2 else "TABLE"

    result = {table_name: []}
    batch_size = 25
    batches = [items[i:i+batch_size] for i in range(0, len(items), batch_size)]

    # Emitir batch a stdout (solo el primero; el script shell llama una vez por batch)
    # Para simplicidad emitimos todos como un único JSON con múltiples lotes serializados
    for batch in batches:
        payload = {table_name: [{"PutRequest": {"Item": item}} for item in batch]}
        print(json.dumps(payload))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: ddb_transform.py <scan_output.json> <table_name>", file=sys.stderr)
        sys.exit(1)
    transform(sys.argv[1])
