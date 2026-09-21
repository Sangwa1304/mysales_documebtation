const API = "/api/audit";

const liste = document.getElementById("auditList");
const recherche = document.getElementById("rechercheAudit");
const filtreAction = document.getElementById("filtreAction");
const compteur = document.getElementById("compteurAudit");
const boutonActualiser = document.getElementById("btnActualiser");

const nomUtilisateur = document.getElementById("nomUtilisateur");

const roleUtilisateur = document.getElementById("roleUtilisateur");

const boutonDeconnexion = document.getElementById("boutonDeconnexion");

let audits = [];
let chargementEnCours = false;

/* =========================================================
   SESSION
   ========================================================= */

async function verifierSession() {
  try {
    const response = await fetch("/api/session", {
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok || !data.connecte) {
      window.location.href = "/login.html";

      return false;
    }

    if (data.utilisateur.role !== "admin") {
      window.location.href = "/index.html";

      return false;
    }

    if (nomUtilisateur) {
      nomUtilisateur.textContent = data.utilisateur.nom;
    }

    if (roleUtilisateur) {
      roleUtilisateur.textContent = "Administrateur";
    }

    return true;
  } catch (error) {
    console.error("Erreur session :", error);

    window.location.href = "/login.html";

    return false;
  }
}

/* =========================================================
   DÉCONNEXION
   ========================================================= */

if (boutonDeconnexion) {
  boutonDeconnexion.addEventListener("click", async () => {
    const confirmation = confirm("Voulez-vous vous déconnecter ?");

    if (!confirmation) {
      return;
    }

    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Erreur déconnexion :", error);
    } finally {
      window.location.href = "/login.html";
    }
  });
}

/* =========================================================
   CHARGER L'AUDIT
   ========================================================= */

async function chargerAudit() {
  if (chargementEnCours) {
    return;
  }

  chargementEnCours = true;

  try {
    const response = await fetch(`${API}?limit=500`, {
      credentials: "include",
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Impossible de charger l'audit.");
    }

    audits = Array.isArray(data) ? data : [];

    afficherAudit();
  } catch (error) {
    console.error("Erreur chargement audit :", error);

    if (!audits.length) {
      liste.innerHTML = `
                <tr>
                    <td colspan="7">
                        Impossible de charger le journal d'audit.
                    </td>
                </tr>
            `;
    }
  } finally {
    chargementEnCours = false;
  }
}

/* =========================================================
   AFFICHER LES DONNÉES
   ========================================================= */

function afficherAudit() {
  const texteRecherche = recherche ? recherche.value.trim().toLowerCase() : "";

  const actionChoisie = filtreAction ? filtreAction.value : "";

  const lignes = audits.filter((audit) => {
    const texte = [
      audit.utilisateur || "",
      audit.email || "",
      audit.action || "",
      audit.methode || "",
      audit.route || "",
      audit.adresse_ip || "",
      audit.statut_http || "",
    ]
      .join(" ")
      .toLowerCase();

    const rechercheOK = !texteRecherche || texte.includes(texteRecherche);

    const actionOK = !actionChoisie || audit.action === actionChoisie;

    return rechercheOK && actionOK;
  });

  if (compteur) {
    compteur.textContent = `${lignes.length} opération${
      lignes.length > 1 ? "s" : ""
    }`;
  }

  if (!lignes.length) {
    liste.innerHTML = `
            <tr>
                <td colspan="7">
                    Aucune opération trouvée.
                </td>
            </tr>
        `;

    return;
  }

  liste.innerHTML = lignes
    .map((audit) => {
      const statut = Number(audit.statut_http);

      let classeStatut = "success";

      if (statut >= 400 && statut < 500) {
        classeStatut = "warning";
      }

      if (statut >= 500) {
        classeStatut = "danger";
      }

      return `
                <tr>

                    <td>
                        <strong>
                            ${formaterDate(audit.date_action)}
                        </strong>
                    </td>

                    <td>

                        <strong>
                            ${escapeHtml(audit.utilisateur || "Système")}
                        </strong>

                        <br>

                        <small>
                            ${escapeHtml(audit.email || "")}
                        </small>

                    </td>

                    <td>

                        <span class="audit-action">
                            ${formaterAction(audit.action)}
                        </span>

                    </td>

                    <td>

                        <span class="badge">
                            ${escapeHtml(audit.methode)}
                        </span>

                    </td>

                    <td>

                        <code>
                            ${escapeHtml(audit.route)}
                        </code>

                    </td>

                    <td>

                        <span class="status ${classeStatut}">
                            ${statut}
                        </span>

                    </td>

                    <td>
                        ${escapeHtml(audit.adresse_ip || "-")}
                    </td>

                </tr>
            `;
    })
    .join("");
}

/* =========================================================
   TRADUCTION DES ACTIONS
   ========================================================= */

function formaterAction(action) {
  const actions = {
    CONNEXION: "Connexion",

    DECONNEXION: "Déconnexion",

    DEMANDE_REINITIALISATION: "Demande de réinitialisation",

    REINITIALISATION_MOT_DE_PASSE: "Réinitialisation du mot de passe",

    CREATION_UTILISATEUR: "Création d'un utilisateur",

    MODIFICATION_UTILISATEUR: "Modification d'un utilisateur",

    SUPPRESSION_UTILISATEUR: "Suppression d'un utilisateur",

    CREATION_CLIENT: "Création d'un client",

    MODIFICATION_CLIENT: "Modification d'un client",

    SUPPRESSION_CLIENT: "Suppression d'un client",

    CREATION_PRODUIT: "Création d'un produit",

    MODIFICATION_PRODUIT: "Modification d'un produit",

    SUPPRESSION_PRODUIT: "Suppression d'un produit",

    MODIFICATION_STOCK: "Modification du stock",

    CREATION_VENTE: "Création d'une vente",

    CONSULTATION_STOCK: "Consultation du stock",

    CONSULTATION_AUDIT: "Consultation de l'audit",
  };

  return actions[action] || action;
}

/* =========================================================
   FORMAT DATE
   ========================================================= */

function formaterDate(date) {
  if (!date) {
    return "-";
  }

  const valeur = new Date(date);

  if (Number.isNaN(valeur.getTime())) {
    return "-";
  }

  return valeur.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

/* =========================================================
   PROTECTION HTML
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => {
    const remplacement = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };

    return remplacement[character];
  });
}

/* =========================================================
   RECHERCHE
   ========================================================= */

if (recherche) {
  recherche.addEventListener("input", afficherAudit);
}

/* =========================================================
   FILTRE
   ========================================================= */

if (filtreAction) {
  filtreAction.addEventListener("change", afficherAudit);
}

/* =========================================================
   BOUTON ACTUALISER
   ========================================================= */

if (boutonActualiser) {
  boutonActualiser.addEventListener("click", async () => {
    boutonActualiser.disabled = true;

    boutonActualiser.textContent = "Actualisation...";

    await chargerAudit();

    boutonActualiser.disabled = false;

    boutonActualiser.textContent = "Actualiser";
  });
}

/* =========================================================
   ACTUALISATION AUTOMATIQUE
   ========================================================= */

setInterval(() => {
  if (document.visibilityState === "visible") {
    chargerAudit();
  }
}, 3000);

/* =========================================================
   DÉMARRAGE
   ========================================================= */

async function demarrer() {
  const sessionValide = await verifierSession();

  if (!sessionValide) {
    return;
  }

  await chargerAudit();
}

demarrer();
