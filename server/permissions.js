// Regras de autorização por cargo. Proprietários e administradores são
// tratados pelo middleware principal; este helper decide os demais cargos.
export const permissionAllows = (permissions, domain, table, action) => {
  // Um membro sem cargo configurado pode consultar, mas não deve ganhar
  // permissões de escrita por omissão.
  if (!permissions || typeof permissions !== "object") return action === "view";
  for (const value of [permissions[table], permissions[domain], permissions[`${domain}.${action}`], permissions[`${table}.${action}`]]) {
    if (Array.isArray(value)) return value.includes(action) || value.includes("admin") || value.includes("administrate");
    if (typeof value === "boolean") return value;
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, action)) return Boolean(value[action]);
  }
  return action === "view";
};
