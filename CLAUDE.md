# Contract Portal - Project Overview

## Purpose
Generate customizable rental contracts for landlords. Template-based system with digital signatures, email/SMS delivery, and tenant tracking.

## Current Stack
- **Frontend**: Streamlit (Python)
- **Template Engine**: docxtpl (Word .docx templates)
- **Signatures**: Canvas-based digital signature capture
- **Email**: SMTP (Gmail)
- **PDF Conversion**: docx2pdf

## Core Features
1. Contract generation from Word template
2. Digital signature capture (landlord + tenant)
3. Email delivery with attachment
4. Property/tenant data collection

## Data Tracked
- Tenant: name, SSN (last 4), license #, current residence
- Property: unit, location, amenities (rooms, appliances, AC, etc.)
- Occupants: names, count
- Lease: start date, end date, length (months/years)
- Payment: monthly rent ($ + verbal), due date, late fee day
- Signatures: both parties

## Template Variables
`dia, mes, anio, nombre_arrendatario, seguro_social, numero_licencia, residencia_actual, cantidad_cuartos, tiene_puertas_de_espejo, cantidad_abanicos_techo, tiene_bano_remodelado, cantidad_estufas, tiene_microondas, tiene_nevera, tiene_aire_acondicionado, cantidad_stools, tiene_cortinas_miniblinds, tiene_sofa, tiene_futton, tiene_cuadros, incluye_estacionamiento, cantidad_personas, cantidad_de_anios_contrato, cantidad_de_meses_contrato, dia_comienzo_contrato, mes_comienzo_contrato, anio_comienzo_contrato, dia_que_culmina_contrato, mes_que_culmina_contrato, anio_que_culmina_contrato, canon_arrendamiento_numero, canon_arrendamiento_verbal, cantidad_pago_firma, dia_pago_tarde, cantidad_llaves, firma_arrendador, firma_arrendatario`

## Files
- `contract_automation.py` - Main Streamlit app
- `launcher.py` - Standalone launcher (PyInstaller compatible)
- `CONTRATO_SABANA_GARDENS_prueba.docx` - Spanish lease template
- `requirements.txt` - Dependencies

## Extension Goals
- Multi-property support
- SMS notifications (Twilio)
- Contract type flexibility (not just leases)
- Dashboard for tracking active leases
- Apple-style minimal UI
- Database persistence (SQLite → PostgreSQL)
