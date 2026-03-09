#!/usr/bin/env python3
"""
Seed script: inserta pagos mock en DynamoDB para desarrollo.

Uso:
  1.  aws sso login --profile aski
  2.  python3 scripts/seed_payments.py

El script consulta los pacientes y usuarios existentes para obtener IDs
reales y luego inserta registros de pago realistas.
"""

import boto3
import json
import random
import time
from datetime import datetime, timedelta, timezone

PROFILE = "aski"
REGION  = "us-east-1"
PATIENT_TABLE = "clinical-patients"
USER_TABLE    = "clinical-users"
PAYMENT_TABLE = "clinical-payments"

METHODS   = ["efectivo", "transferencia", "tarjeta", "zelle"]
TYPES     = ["pago_completo", "abono"]
CURRENCIES = ["USD", "VES"]
NOTES_USD  = ["Consulta general", "Limpieza dental", "Revisión de ortodoncia", "Extracción", "Relleno", "Blanqueamiento", ""]
NOTES_VES  = ["Consulta de rutina", "Control mensual", "Radiografía panorámica", "Profilaxis", ""]

session = boto3.Session(profile_name=PROFILE, region_name=REGION)
dynamo  = session.client("dynamodb")

# ─── Obtener pacientes ───────────────────────────────────────
print("→ Consultando pacientes...")
resp = dynamo.scan(TableName=PATIENT_TABLE, Limit=50)
items = resp.get("Items", [])
print(f"  Encontrados: {len(items)} pacientes")

if not items:
    print("  ⚠️  No hay pacientes en la BD. Crea pacientes primero.")
    exit(1)

# Extraer orgId del primer paciente (PK = ORG#<orgId>)
first_pk = items[0]["PK"]["S"]
org_id   = first_pk.replace("ORG#", "")
print(f"  OrgId: {org_id}")

patients = []
for item in items:
    pid = item.get("PatientID", item.get("ID", {})).get("S", "")
    fname = item.get("FirstName", {}).get("S", "")
    lname = item.get("LastName", {}).get("S", "")
    if pid:
        patients.append({"id": pid, "name": f"{fname} {lname}"})

print(f"  Pacientes a usar: {[p['name'] for p in patients[:5]]}")

# ─── Obtener doctores ────────────────────────────────────────
print("→ Consultando doctores...")
resp = dynamo.scan(
    TableName=USER_TABLE,
    FilterExpression="contains(SK, :role)",
    ExpressionAttributeValues={":role": {"S": "doctor"}}
)
doc_items = resp.get("Items", [])
doctors = []
for item in doc_items:
    uid = item.get("UserID", item.get("ID", {})).get("S", "")
    if uid:
        doctors.append(uid)
if not doctors:
    doctors = ["doctor_mock"]
print(f"  Doctores: {len(doctors)}")

# ─── Generar y escribir pagos ────────────────────────────────
print("→ Insertando pagos mock...")

def build_id(prefix: str) -> str:
    return f"{prefix}_{time.time_ns()}"

def fmt_ts(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%S")

def random_past_date(days_back: int = 90) -> datetime:
    delta = timedelta(days=random.randint(0, days_back),
                      hours=random.randint(8, 18),
                      minutes=random.randint(0, 59))
    return datetime.now(timezone.utc) - delta

MOCK_PAYMENTS = []
for i in range(30):
    patient  = random.choice(patients)
    doctor   = random.choice(doctors)
    currency = random.choice(CURRENCIES)
    amount   = (round(random.uniform(30, 200), 2) if currency == "USD"
                else round(random.uniform(80, 500), 2) * 36)  # VES rough rate
    p_type   = random.choice(TYPES)
    method   = random.choice(METHODS)
    notes    = random.choice(NOTES_USD if currency == "USD" else NOTES_VES)
    created  = random_past_date(90)
    pay_id   = build_id("pay")
    ts_str   = fmt_ts(created)

    MOCK_PAYMENTS.append({
        "PK":            {"S": f"ORG#{org_id}"},
        "SK":            {"S": f"PAYMENT#{ts_str}#{pay_id}"},
        "ID":            {"S": pay_id},
        "PaymentID":     {"S": pay_id},
        "OrgID":         {"S": org_id},
        "PatientID":     {"S": patient["id"]},
        "DoctorID":      {"S": doctor},
        "AppointmentID": {"S": ""},
        "Amount":        {"N": str(amount)},
        "PaymentType":   {"S": p_type},
        "PaymentMethod": {"S": method},
        "Currency":      {"S": currency},
        "Notes":         {"S": notes},
        "CreatedAt":     {"S": created.strftime("%Y-%m-%dT%H:%M:%SZ")},
    })
    time.sleep(0.001)  # ensure unique nano timestamp

# batch-write in groups of 25
total = 0
for i in range(0, len(MOCK_PAYMENTS), 25):
    batch = MOCK_PAYMENTS[i:i+25]
    requests = [{"PutRequest": {"Item": item}} for item in batch]
    dynamo.batch_write_item(RequestItems={PAYMENT_TABLE: requests})
    total += len(batch)
    print(f"  ✓ {total}/{len(MOCK_PAYMENTS)} pagos insertados")

print(f"\n✅ Listo. Se insertaron {total} pagos mock en '{PAYMENT_TABLE}'.")
print("   Recarga la página de Pagos para verlos.")
