// Baseline Terms and Privacy text (Plan 26). Pending review by a Puerto Rico
// attorney before launch; keep ES and EN in step when editing.
// Section 6 of the Terms (referral program, Plan 37) is new and also pending that review.

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
  altHref: string;
  altLabel: string;
};

const CONTACT = "hola@prcontract.online";

export const TERMS_ES: LegalDoc = {
  title: "Términos de servicio",
  updated: "Última actualización: 8 de octubre de 2026",
  intro:
    "Estos términos regulan el uso de ContractOS (prcontract.online y sus aplicaciones). Al crear una cuenta o usar el servicio, aceptas estos términos.",
  altHref: "/en/terms",
  altLabel: "English",
  sections: [
    {
      heading: "1. El servicio",
      body: [
        "ContractOS es una herramienta para que propietarios y administradores preparen, envíen y firmen electrónicamente contratos de arrendamiento, y lleven registros de propiedades, inquilinos, pagos y gastos.",
        "ContractOS no es un bufete de abogados y no ofrece asesoría legal, contributiva ni financiera. Las plantillas e información son de carácter general; consulta a un abogado o contador para tu situación particular.",
      ],
    },
    {
      heading: "2. Tu cuenta",
      body: [
        "Debes ser mayor de edad y dar información veraz. Eres responsable de mantener segura tu contraseña y de toda actividad en tu cuenta.",
        "Si usas el servicio en nombre de una empresa, declaras que tienes autoridad para obligarla.",
      ],
    },
    {
      heading: "3. Tus responsabilidades como arrendador",
      body: [
        "Eres responsable del contenido de tus contratos y de cumplir con las leyes aplicables, incluyendo el Código Civil de Puerto Rico, las leyes de vivienda justa y las de protección de datos.",
        "Solo debes registrar información de inquilinos que tengas derecho a recopilar, y debes obtener su consentimiento para enviarles comunicaciones por correo electrónico, SMS o WhatsApp.",
      ],
    },
    {
      heading: "4. Firmas electrónicas",
      body: [
        "Las partes que firman a través de ContractOS consienten en usar documentos y firmas electrónicas, reconocidos por la Ley 148-2006 de Transacciones Electrónicas de Puerto Rico y la ley federal ESIGN.",
        "Guardamos un registro de cada firma (fecha, hora, dirección IP y dispositivo) para dar evidencia de la transacción.",
      ],
    },
    {
      heading: "5. Planes y pagos",
      body: [
        "Los planes pagados se facturan por adelantado a través de Stripe y se renuevan automáticamente hasta que los canceles. Puedes cancelar en cualquier momento desde Facturación; el acceso continúa hasta el final del período pagado.",
        "Salvo que la ley disponga otra cosa, los pagos no son reembolsables por períodos parciales. Podemos cambiar los precios con aviso previo de al menos 30 días.",
      ],
    },
    {
      heading: "6. Programa de referidos",
      body: [
        "Puedes compartir tu enlace de referido. Si otro propietario crea una cuenta con tu enlace y paga su primera factura de un plan pagado, recibirás un mes gratis de tu plan, aplicado como descuento a tu próxima factura. Si en ese momento no tienes una suscripción activa, o ya tienes otro descuento, aplicaremos la recompensa manualmente cuando sea posible.",
        "La recompensa no tiene valor en efectivo, no es transferible y no se puede cambiar por dinero. Se excluyen los auto-referidos (incluyendo cuentas duplicadas o de la misma persona o empresa) y cualquier uso fraudulento o abusivo; en esos casos podemos negar o revertir la recompensa.",
        "Podemos cambiar o terminar el programa en cualquier momento. Los cambios no afectan recompensas ya ganadas.",
      ],
    },
    {
      heading: "7. Uso aceptable",
      body: [
        "No puedes usar el servicio para actividades ilegales, discriminatorias o fraudulentas, enviar mensajes no solicitados, ni intentar acceder a datos de otros usuarios o vulnerar la seguridad del servicio.",
      ],
    },
    {
      heading: "8. Tu contenido",
      body: [
        "Tus datos y documentos son tuyos. Nos das permiso para almacenarlos y procesarlos solo para operar el servicio. Puedes exportarlos o pedir que los borremos.",
      ],
    },
    {
      heading: "9. Garantías y responsabilidad",
      body: [
        "El servicio se ofrece \"tal cual\". En la medida que la ley lo permita, no garantizamos que esté libre de errores o interrupciones, y nuestra responsabilidad total se limita a lo que nos pagaste en los 12 meses anteriores al reclamo.",
      ],
    },
    {
      heading: "10. Terminación",
      body: [
        "Puedes cerrar tu cuenta en cualquier momento. Podemos suspender cuentas que violen estos términos, con aviso cuando sea razonable.",
      ],
    },
    {
      heading: "11. Ley aplicable y contacto",
      body: [
        "Estos términos se rigen por las leyes de Puerto Rico. Para preguntas, escríbenos a " + CONTACT + ".",
      ],
    },
  ],
};

export const TERMS_EN: LegalDoc = {
  title: "Terms of Service",
  updated: "Last updated: October 8, 2026",
  intro:
    "These terms govern your use of ContractOS (prcontract.online and its apps). By creating an account or using the service, you agree to them.",
  altHref: "/terminos",
  altLabel: "Español",
  sections: [
    {
      heading: "1. The service",
      body: [
        "ContractOS helps landlords and property managers prepare, send and electronically sign lease agreements, and keep records of properties, tenants, payments and expenses.",
        "ContractOS is not a law firm and does not give legal, tax or financial advice. Templates and information are general; consult an attorney or accountant about your situation.",
      ],
    },
    {
      heading: "2. Your account",
      body: [
        "You must be an adult and provide accurate information. You are responsible for keeping your password secure and for all activity in your account.",
        "If you use the service for a business, you represent that you may bind it.",
      ],
    },
    {
      heading: "3. Your responsibilities as a landlord",
      body: [
        "You are responsible for your contracts' content and for complying with applicable law, including the Puerto Rico Civil Code, fair housing laws and data protection laws.",
        "Only record tenant information you are entitled to collect, and obtain tenants' consent before messaging them by email, SMS or WhatsApp.",
      ],
    },
    {
      heading: "4. Electronic signatures",
      body: [
        "Parties who sign through ContractOS consent to electronic records and signatures, recognized by Puerto Rico's Electronic Transactions Act (Law 148-2006) and the federal ESIGN Act.",
        "We keep a record of each signature (date, time, IP address and device) as evidence of the transaction.",
      ],
    },
    {
      heading: "5. Plans and payments",
      body: [
        "Paid plans are billed in advance through Stripe and renew automatically until cancelled. You can cancel anytime from Billing; access continues until the end of the paid period.",
        "Unless the law requires otherwise, payments are not refundable for partial periods. We may change prices with at least 30 days' notice.",
      ],
    },
    {
      heading: "6. Referral program",
      body: [
        "You can share your referral link. If another landlord creates an account with your link and pays their first invoice for a paid plan, you get one free month of your plan, applied as a discount on your next invoice. If at that time you have no active subscription, or you already have another discount, we will apply the reward manually when possible.",
        "The reward has no cash value, is not transferable and cannot be exchanged for money. Self-referrals (including duplicate accounts or accounts of the same person or business) and any fraudulent or abusive use are excluded; in those cases we may deny or reverse the reward.",
        "We may change or end the program at any time. Changes do not affect rewards already earned.",
      ],
    },
    {
      heading: "7. Acceptable use",
      body: [
        "Do not use the service for illegal, discriminatory or fraudulent activity, to send unsolicited messages, or to access other users' data or break the service's security.",
      ],
    },
    {
      heading: "8. Your content",
      body: [
        "Your data and documents are yours. You let us store and process them only to operate the service. You can export them or ask us to delete them.",
      ],
    },
    {
      heading: "9. Warranties and liability",
      body: [
        "The service is provided \"as is\". To the extent the law allows, we do not warrant that it is error-free or uninterrupted, and our total liability is limited to what you paid us in the 12 months before the claim.",
      ],
    },
    {
      heading: "10. Termination",
      body: [
        "You may close your account at any time. We may suspend accounts that break these terms, with notice when reasonable.",
      ],
    },
    {
      heading: "11. Governing law and contact",
      body: ["These terms are governed by the laws of Puerto Rico. Questions: " + CONTACT + "."],
    },
  ],
};

export const PRIVACY_ES: LegalDoc = {
  title: "Política de privacidad",
  updated: "Última actualización: 7 de octubre de 2026",
  intro:
    "Esta política explica qué datos recopila ContractOS, cómo los usamos y qué opciones tienes.",
  altHref: "/en/privacy",
  altLabel: "English",
  sections: [
    {
      heading: "1. Datos que recopilamos",
      body: [
        "De arrendadores: nombre, correo electrónico, teléfono, empresa, datos de facturación (procesados por Stripe; no guardamos números de tarjeta).",
        "Datos que los arrendadores registran sobre propiedades e inquilinos, como nombres, contacto, identificación y datos de empleo, según los contratos lo requieran.",
        "Datos de firma: imagen de la firma, fecha, hora, dirección IP y dispositivo.",
        "Datos de uso: páginas visitadas y rendimiento, con analítica que no usa cookies de rastreo.",
      ],
    },
    {
      heading: "2. Cómo los usamos",
      body: [
        "Para operar el servicio: generar y enviar contratos, recordatorios y recibos; procesar pagos; dar soporte; y mantener la seguridad.",
        "No vendemos datos personales ni los usamos para publicidad de terceros.",
      ],
    },
    {
      heading: "3. Con quién los compartimos",
      body: [
        "Con proveedores que nos ayudan a operar, bajo contrato: Supabase (base de datos), Vercel (alojamiento y analítica), Stripe (pagos), Resend (correo), Twilio (SMS y WhatsApp) y Anthropic (funciones de IA, cuando las uses).",
        "Con las otras partes de un contrato, cuando el arrendador lo envía para firma. Con autoridades, cuando la ley lo exija.",
      ],
    },
    {
      heading: "4. Mensajes de texto",
      body: [
        "Si das tu número, puedes recibir mensajes sobre contratos, pagos y recordatorios. Pueden aplicar cargos de mensajes y datos. Responde STOP para dejar de recibirlos o HELP para ayuda.",
      ],
    },
    {
      heading: "5. Seguridad",
      body: [
        "Usamos cifrado en tránsito, control de acceso por usuario y registros de auditoría. Si ocurre una brecha que afecte información personal, notificaremos a las personas afectadas y al Departamento de Asuntos del Consumidor (DACO) según la Ley 111-2005.",
      ],
    },
    {
      heading: "6. Retención y tus derechos",
      body: [
        "Guardamos los datos mientras tu cuenta esté activa y el tiempo que la ley requiera para contratos firmados. Puedes pedir acceso, corrección, exportación o eliminación de tus datos escribiendo a " + CONTACT + ".",
        "Los inquilinos pueden dirigir sus solicitudes al arrendador o a nosotros.",
      ],
    },
    {
      heading: "7. Menores",
      body: ["El servicio no está dirigido a menores de 18 años."],
    },
    {
      heading: "8. Cambios y contacto",
      body: [
        "Publicaremos cualquier cambio en esta página y avisaremos de cambios importantes. Preguntas: " + CONTACT + ".",
      ],
    },
  ],
};

export const PRIVACY_EN: LegalDoc = {
  title: "Privacy Policy",
  updated: "Last updated: October 7, 2026",
  intro: "This policy explains what data ContractOS collects, how we use it, and your choices.",
  altHref: "/privacidad",
  altLabel: "Español",
  sections: [
    {
      heading: "1. Data we collect",
      body: [
        "From landlords: name, email, phone, company, and billing details (processed by Stripe; we never store card numbers).",
        "Data landlords record about properties and tenants, such as names, contact details, identification and employment details as their contracts require.",
        "Signature data: the signature image, date, time, IP address and device.",
        "Usage data: pages visited and performance, through analytics that use no tracking cookies.",
      ],
    },
    {
      heading: "2. How we use it",
      body: [
        "To run the service: generate and send contracts, reminders and receipts; process payments; provide support; and keep it secure.",
        "We do not sell personal data or use it for third-party advertising.",
      ],
    },
    {
      heading: "3. Who we share it with",
      body: [
        "Service providers under contract: Supabase (database), Vercel (hosting and analytics), Stripe (payments), Resend (email), Twilio (SMS and WhatsApp) and Anthropic (AI features, when you use them).",
        "Other parties to a contract, when the landlord sends it for signature. Authorities, when the law requires.",
      ],
    },
    {
      heading: "4. Text messages",
      body: [
        "If you give your number, you may receive messages about contracts, payments and reminders. Message and data rates may apply. Reply STOP to opt out or HELP for help.",
      ],
    },
    {
      heading: "5. Security",
      body: [
        "We use encryption in transit, per-user access control and audit logs. If a breach affects personal information, we will notify affected people and Puerto Rico's Department of Consumer Affairs (DACO) under Law 111-2005.",
      ],
    },
    {
      heading: "6. Retention and your rights",
      body: [
        "We keep data while your account is active and as long as the law requires for signed contracts. Ask for access, correction, export or deletion at " + CONTACT + ".",
        "Tenants may send requests to their landlord or to us.",
      ],
    },
    {
      heading: "7. Children",
      body: ["The service is not directed to anyone under 18."],
    },
    {
      heading: "8. Changes and contact",
      body: ["We will post changes on this page and announce important ones. Questions: " + CONTACT + "."],
    },
  ],
};
