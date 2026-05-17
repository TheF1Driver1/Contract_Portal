import io
import os
import smtplib
import ssl

import streamlit as st
from docx.shared import Mm
from docxtpl import DocxTemplate, InlineImage
from email.message import EmailMessage
from PIL import Image
from streamlit_drawable_canvas import st_canvas

TEMPLATE_FILE = "CONTRATO_SABANA_GARDENS_prueba.docx"
SIGNATURE_PLACEHOLDER = "_________________________"
MONTHS = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def check(val):
    return "✔" if str(val).lower() in ["sí", "si"] else "__________"


def canvas_to_bytesio(canvas):
    if canvas.image_data is None:
        return None
    img = Image.fromarray(canvas.image_data.astype("uint8"))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def build_context(doc, fields, sig_tenant_io, sig_landlord_io):
    sig_tenant = (
        InlineImage(doc, sig_tenant_io, width=Mm(40))
        if sig_tenant_io else SIGNATURE_PLACEHOLDER
    )
    sig_landlord = (
        InlineImage(doc, sig_landlord_io, width=Mm(40))
        if sig_landlord_io else SIGNATURE_PLACEHOLDER
    )
    return {**fields, "firma_arrendatario": sig_tenant, "firma_arrendador": sig_landlord}


def send_contract_email(sender, password, recipient, filename, docx_data):
    msg = EmailMessage()
    msg["Subject"] = "Contrato Sabana Gardens"
    msg["From"] = sender
    msg["To"] = recipient
    msg.set_content("Adjunto encontrarás el contrato generado.")
    msg.add_attachment(
        docx_data,
        maintype="application",
        subtype="vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
    )
    ssl_context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl_context) as server:
        server.login(sender, password)
        server.send_message(msg)


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------

st.title("Contrato Automatizado - Editor")

st.subheader("📅 Fecha de hoy")
dia = st.text_input("Día", "27")
mes = st.text_input("Mes", "agosto")
anio = st.text_input("Año", "2025")

st.subheader("👤 Arrendatario")
nombre_arrendatario = st.text_input("Nombre del Arrendatario", "Juan Pérez")
seguro_social = st.text_input("Seguro Social (Ultimos 4 Digitos)", "xxx-xx-6789")
numero_licencia = st.text_input("Número de Licencia", "A1234567")
residencia_actual = st.text_input("Residencia Actual", "Carolina, Puerto Rico")

st.subheader("🏠 Detalles de la Propiedad")
cantidad_cuartos = st.selectbox("Cantidad de Cuartos", ["1", "2", "3", "4"])
tiene_puertas_de_espejo = st.selectbox("Incluye Puertas de Espejo?", ["sí", "no"])
cantidad_abanicos_techo = st.selectbox("Cantidad de Abanicos de Techo", ["1", "2", "3", "4"])
tiene_bano_remodelado = st.selectbox("Baño Remodelado?", ["sí", "no"])
cantidad_estufas = st.selectbox("Cantidad de Estufas", ["1", "2"])
tiene_microondas = st.selectbox("Incluye Microondas?", ["sí", "no"])
tiene_nevera = st.selectbox("Incluye Nevera?", ["sí", "no"])
tiene_aire_acondicionado = st.selectbox("Incluye Aire Acondicionado?", ["sí", "no"])
cantidad_stools = st.selectbox("Cantidad de Stools", ["1", "2", "3", "4"])
tiene_cortinas_miniblinds = st.selectbox("Incluye Cortinas Mini Blinds?", ["sí", "no"])
tiene_sofa = st.selectbox("Incluye Sofá?", ["sí", "no"])
tiene_futton = st.selectbox("Incluye Futón?", ["sí", "no"])
tiene_cuadros = st.selectbox("Incluye Cuadros?", ["sí", "no"])
incluye_estacionamiento = st.selectbox("Estacionamiento Incluido?", ["sí", "no"])

st.subheader("👥 Ocupación")
cantidad_personas = st.selectbox("Cantidad de Personas", ["1", "2", "3", "4", "5"])

st.subheader("📜 Contrato")
cantidad_de_anios_contrato = st.text_input("Años de Contrato", "1")
cantidad_de_meses_contrato = st.selectbox(
    "Meses de Contrato", ["3", "6", "9", "12", "15", "18", "21", "24"]
)
dia_comienzo_contrato = st.selectbox(
    "Día de Inicio de Contrato", [str(i) for i in range(1, 32)]
)
mes_comienzo_contrato = st.selectbox("Mes de Inicio de Contrato", MONTHS)
anio_comienzo_contrato = st.text_input("Año de Inicio de Contrato", "2025")
dia_que_culmina_contrato = st.selectbox(
    "Día de Culminación de Contrato", [str(i) for i in range(1, 32)]
)
mes_que_culmina_contrato = st.selectbox("Mes de Culminación de Contrato", MONTHS)
anio_que_culmina_contrato = st.text_input("Año de Culminación de Contrato", "2026")

st.subheader("💰 Pagos")
canon_arrendamiento_numero = st.text_input("Canon de Arrendamiento (número)", "1200")
canon_arrendamiento_verbal = st.text_input("Canon de Arrendamiento (texto)", "mil doscientos")
cantidad_pago_firma = st.text_input("Cantidad a Pagar al Firmar", "1200")
dia_pago_tarde = st.text_input("Día de Pago Tardío", "5")

st.subheader("🔑 Otros")
cantidad_llaves = st.selectbox("Cantidad de Llaves", ["1", "2", "3"])

st.subheader("✍️ Firma del Arrendatario")
canvas_arrendatario = st_canvas(
    stroke_width=2,
    stroke_color="black",
    background_color="white",
    height=150,
    width=400,
    drawing_mode="freedraw",
    key="canvas1",
)

st.subheader("✍️ Firma del Arrendador")
canvas_arrendador = st_canvas(
    stroke_width=2,
    stroke_color="black",
    background_color="white",
    height=150,
    width=400,
    drawing_mode="freedraw",
    key="canvas2",
)

sig_tenant_io = canvas_to_bytesio(canvas_arrendatario)
sig_landlord_io = canvas_to_bytesio(canvas_arrendador)

send_email = st.checkbox("📧 Enviar por Email después de generar")

if send_email:
    sender_email = st.text_input("Correo del remitente")
    sender_password = st.text_input("Contraseña o App Password", type="password")
    recipient_email = st.text_input("Correo del destinatario")

if st.button("Generar y Enviar Contrato"):
    fields = {
        "dia": dia,
        "mes": mes,
        "anio": anio,
        "nombre_arrendatario": nombre_arrendatario,
        "seguro_social": seguro_social,
        "numero_licencia": numero_licencia,
        "residencia_actual": residencia_actual,
        "cantidad_cuartos": cantidad_cuartos,
        "tiene_puertas_de_espejo": check(tiene_puertas_de_espejo),
        "cantidad_abanicos_techo": cantidad_abanicos_techo,
        "tiene_bano_remodelado": check(tiene_bano_remodelado),
        "cantidad_estufas": cantidad_estufas,
        "tiene_microondas": check(tiene_microondas),
        "tiene_nevera": check(tiene_nevera),
        "tiene_aire_acondicionado": check(tiene_aire_acondicionado),
        "cantidad_stools": cantidad_stools,
        "tiene_cortinas_miniblinds": check(tiene_cortinas_miniblinds),
        "tiene_sofa": check(tiene_sofa),
        "tiene_futton": check(tiene_futton),
        "tiene_cuadros": check(tiene_cuadros),
        "incluye_estacionamiento": check(incluye_estacionamiento),
        "cantidad_personas": cantidad_personas,
        "cantidad_de_anios_contrato": cantidad_de_anios_contrato,
        "cantidad_de_meses_contrato": cantidad_de_meses_contrato,
        "dia_comienzo_contrato": dia_comienzo_contrato,
        "mes_comienzo_contrato": mes_comienzo_contrato,
        "anio_comienzo_contrato": anio_comienzo_contrato,
        "dia_que_culmina_contrato": dia_que_culmina_contrato,
        "mes_que_culmina_contrato": mes_que_culmina_contrato,
        "anio_que_culmina_contrato": anio_que_culmina_contrato,
        "canon_arrendamiento_numero": canon_arrendamiento_numero,
        "canon_arrendamiento_verbal": canon_arrendamiento_verbal,
        "cantidad_pago_firma": cantidad_pago_firma,
        "dia_pago_tarde": dia_pago_tarde,
        "cantidad_llaves": cantidad_llaves,
    }

    doc = DocxTemplate(TEMPLATE_FILE)
    context = build_context(doc, fields, sig_tenant_io, sig_landlord_io)
    doc.render(context)

    tenant_name_safe = nombre_arrendatario.replace(" ", "_")
    filename = f"CONTRATO_SABANA_GARDENS_{tenant_name_safe}_{anio_comienzo_contrato}.docx"

    docx_buffer = io.BytesIO()
    doc.save(docx_buffer)
    docx_buffer.seek(0)

    st.download_button(
        label="⬇️ Descargar Contrato DOCX",
        data=docx_buffer,
        file_name=filename,
        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    if send_email and sender_email and sender_password and recipient_email:
        docx_buffer.seek(0)
        try:
            send_contract_email(
                sender_email, sender_password, recipient_email,
                filename, docx_buffer.read(),
            )
            st.success(f"📧 Contrato enviado a {recipient_email}")
        except Exception as e:
            st.error(f"❌ Error al enviar correo: {e}")
