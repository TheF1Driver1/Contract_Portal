import { z, ZodIssueCode, type ZodErrorMap } from "zod";

// Spanish (Puerto Rico) validation messages. API responses and server
// actions surface these to users, and Spanish is the default locale.
export const spanishErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "Este campo es requerido." };
      return { message: "Valor inválido." };
    case ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: issue.minimum === 1 ? "Este campo es requerido." : `Debe tener al menos ${issue.minimum} caracteres.` };
      }
      if (issue.type === "number") {
        return { message: issue.inclusive ? `Debe ser ${issue.minimum} o más.` : `Debe ser mayor que ${issue.minimum}.` };
      }
      if (issue.type === "array") return { message: `Selecciona al menos ${issue.minimum}.` };
      return { message: "Valor muy pequeño." };
    case ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Máximo ${issue.maximum} caracteres.` };
      if (issue.type === "number") return { message: issue.inclusive ? `Debe ser ${issue.maximum} o menos.` : `Debe ser menor que ${issue.maximum}.` };
      if (issue.type === "array") return { message: `Máximo ${issue.maximum} elementos.` };
      return { message: "Valor muy grande." };
    case ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Escribe un correo electrónico válido." };
      if (issue.validation === "url") return { message: "Escribe un enlace válido." };
      if (issue.validation === "uuid") return { message: "Identificador inválido." };
      if (issue.validation === "regex") return { message: "Formato inválido." };
      return { message: "Texto inválido." };
    case ZodIssueCode.invalid_enum_value:
      return { message: "Selecciona una opción válida." };
    case ZodIssueCode.invalid_date:
      return { message: "Fecha inválida." };
    case ZodIssueCode.not_finite:
      return { message: "Número inválido." };
    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(spanishErrorMap);
