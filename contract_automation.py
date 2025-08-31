import streamlit as st
from streamlit_drawable_canvas import st_canvas
from PIL import Image
from io import BytesIO
from docxtpl import DocxTemplate, InlineImage
from docx.shared import Mm
import os
import smtplib
from email.message import EmailMessage
from docx2pdf import convert
import tempfile

# Helper function
def check(val):
    return "✔" if str(val).lower() in ["sí", "si"] else "__________"

# Template file
TEMPLATE_FILE = "CONTRATO_SABANA_GARDENS_prueba.docx"

st.title("Contrato Automatizado - Editor")

# --------------------------
# USER INPUTS
# --------------------------
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
cantidad_cuartos = st.selectbox("Cantidad de Cuartos", ["1","2","3","4"])
tiene_puertas_de_espejo = st.selectbox("Incluye Puertas de Espejo?", ["sí", "no"])
cantidad_abanicos_techo = st.selectbox("Cantidad de Abanicos de Techo", ["1","2","3","4"])
tiene_bano_remodelado = st.selectbox("Baño Remodelado?", ["sí", "no"])
cantidad_estufas = st.selectbox("Cantidad de Estufas", ["1","2"])
tiene_microondas = st.selectbox("Incluye Microondas?", ["sí", "no"])
tiene_nevera = st.selectbox("Incluye Nevera?", ["sí", "no"])
tiene_aire_acondicionado = st.selectbox("Incluye Aire Acondicionado?", ["sí", "no"])
cantidad_stools = st.selectbox("Cantidad de Stools", ["1","2","3","4"])
tiene_cortinas_miniblinds = st.selectbox("Incluye Cortinas Mini Blinds?", ["sí", "no"])
tiene_sofa = st.selectbox("Incluye Sofá?", ["sí", "no"])
tiene_futton = st.selectbox("Incluye Futón?", ["sí", "no"])
tiene_cuadros = st.selectbox("Incluye Cuadros?", ["sí", "no"])
incluye_estacionamiento = st.selectbox("Estacionamiento Incluido?", ["sí", "no"])

st.subheader("👥 Ocupación")
cantidad_personas = st.selectbox("Cantidad de Personas", ["1","2","3","4","5"])

st.subheader("📜 Contrato")
cantidad_de_anios_contrato = st.text_input("Años de Contrato", "1")
cantidad_de_meses_contrato = st.selectbox("Meses de Contrato", ["3","6","9","12","15","18","21","24"])
dia_comienzo_contrato = st.selectbox("Día de Inicio de Contrato", [str(i) for i in range(1,32)])
mes_comienzo_contrato = st.selectbox("Mes de Inicio de Contrato", ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"])
anio_comienzo_contrato = st.text_input("Año de Inicio de Contrato", "2025")
dia_que_culmina_contrato = st.selectbox("Día de Culminación de Contrato", [str(i) for i in range(1,32)])
mes_que_culmina_contrato = st.selectbox("Mes de Culminación de Contrato", ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"])
anio_que_culmina_contrato = st.text_input("Año de Culminación de Contrato", "2026")

st.subheader("💰 Pagos")
canon_arrendamiento_numero = st.text_input("Canon de Arrendamiento (número)", "1200")
canon_arrendamiento_verbal = st.text_input("Canon de Arrendamiento (texto)", "mil doscientos")
cantidad_pago_firma = st.text_input("Cantidad a Pagar al Firmar", "1200")
dia_pago_tarde = st.text_input("Día de Pago Tardío", "5")

st.subheader("🔑 Otros")
cantidad_llaves = st.selectbox("Cantidad de Llaves", ["1","2","3"])

firma_arrendador = "_________________________"
firma_arrendatario = "_________________________"

# --------------------------
# SIGNATURES
# --------------------------
st.subheader("✍️ Firma del Arrendatario")
canvas_arrendatario = st_canvas(
    stroke_width=2, stroke_color="black", background_color="white",
    height=150, width=400, drawing_mode="freedraw", key="canvas1"
)

st.subheader("✍️ Firma del Arrendador")
canvas_arrendador = st_canvas(
    stroke_width=2, stroke_color="black", background_color="white",
    height=150, width=400, drawing_mode="freedraw", key="canvas2"
)

# Convert canvas images to in-memory BytesIO
firma_arrendatario_img_io = None
firma_arrendador_img_io = None

if canvas_arrendatario.image_data is not None:
    arr_img = Image.fromarray(canvas_arrendatario.image_data.astype('uint8'))
    firma_arrendatario_img_io = BytesIO()
    arr_img.save(firma_arrendatario_img_io, format="PNG")
    firma_arrendatario_img_io.seek(0)

if canvas_arrendador.image_data is not None:
    arr_img2 = Image.fromarray(canvas_arrendador.image_data.astype('uint8'))
    firma_arrendador_img_io = BytesIO()
    arr_img2.save(firma_arrendador_img_io, format="PNG")
    firma_arrendador_img_io.seek(0)

# --------------------------
# GENERATE AND SEND CONTRACT
# --------------------------
folder_selected = st.text_input(
    "📁 Ingresa la ruta de la carpeta donde guardar el contrato",
    os.path.expanduser("~/Documents")
)

send_email = st.checkbox("📧 Enviar por Email después de generar")

if send_email:
    sender_email = st.text_input("Correo del remitente")
    sender_password = st.text_input("Contraseña o App Password", type="password")
    recipient_email = st.text_input("Correo del destinatario")

if st.button("Generar y Enviar Contrato"):
    if not folder_selected:
        st.warning("❌ Por favor ingresa la ruta de la carpeta para guardar el contrato.")
    else:
        # Dynamic filename
        arr_name_safe = nombre_arrendatario.replace(" ", "_")
        start_year = anio_comienzo_contrato
        dynamic_filename = f"CONTRATO_SABANA_GARDENS_{arr_name_safe}_{start_year}.docx"
        output_path = os.path.join(folder_selected, dynamic_filename)

        # Load template
        doc = DocxTemplate(TEMPLATE_FILE)

        # Inline signatures from memory
        firma_arrendatario_img = InlineImage(doc, firma_arrendatario_img_io, width=Mm(40)) if firma_arrendatario_img_io else firma_arrendatario
        firma_arrendador_img = InlineImage(doc, firma_arrendador_img_io, width=Mm(40)) if firma_arrendador_img_io else firma_arrendador

        context = {
            "dia": dia, "mes": mes, "anio": anio,
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
            "firma_arrendador": firma_arrendador_img,
            "firma_arrendatario": firma_arrendatario_img
        }

        doc.render(context)
        doc.save(output_path)
        st.success(f"✅ Contrato generado en: {output_path}")

        # Safely create a dynamic filename
        arr_name_safe = context["nombre_arrendatario"].replace(" ", "_")
        start_year = context["anio_comienzo_contrato"]
        dynamic_filename = f"CONTRATO_SABANA_GARDENS_{arr_name_safe}_{start_year}.docx"

        # Assuming output_path is your filled DOCX file
        temp_pdf = os.path.splitext(output_path)[0] + ".pdf"  # same name, .pdf extension

        # Convert DOCX to PDF
        convert(output_path, temp_pdf)

        # Provide download for iPhone Files
        with open(temp_pdf, "rb") as f:
            st.download_button(
                label="⬇️ Descargar Contrato PDF",
                data=f,
                file_name=os.path.basename(temp_pdf),
                mime="application/pdf"
    )

        # Download button
        #with open(output_path, "rb") as f:
            #st.download_button("⬇️ Descargar Contrato", f, file_name=dynamic_filename)

'''
        # Send email
        if send_email:
            if sender_email and sender_password and recipient_email:
                try:
                    msg = EmailMessage()
                    msg['Subject'] = "Contrato Sabana Gardens"
                    msg['From'] = sender_email
                    msg['To'] = recipient_email
                    msg.set_content("Adjunto encontrarás el contrato generado.")
                    with open(output_path, "rb") as f:
                        msg.add_attachment(f.read(), maintype="application", subtype="vnd.openxmlformats-officedocument.wordprocessingml.document", filename="CONTRATO_SABANA_GARDENS_filled.docx")

                    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                        smtp.login(sender_email, sender_password)
                        smtp.send_message(msg)
                    st.success(f"📧 Contrato enviado a {recipient_email}")
                except Exception as e:
                    st.error(f"❌ Error al enviar correo: {e}")
            else:
                st.warning("❌ Ingresa todos los campos de correo para enviar el contrato.")
'''