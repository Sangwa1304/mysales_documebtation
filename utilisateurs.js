const API = "/api/utilisateurs";

const formulaire = document.getElementById("utilisateurForm");

const zoneFormulaire = document.getElementById("formulaireUtilisateur");

const liste = document.getElementById("listeUtilisateurs");

const compteur = document.getElementById("compteurUtilisateurs");

const nom = document.getElementById("nomUtilisateurForm");

const email = document.getElementById("emailUtilisateur");

const motDePasse = document.getElementById("motDePasseUtilisateur");

const role = document.getElementById("roleUtilisateurForm");

let utilisateurEnModification = null;

// ======================================================
// PROTECTION HTML
// ======================================================

function protegerTexte(texte) {
  return String(texte || "").replace(/[&<>'"]/g, function (caractere) {
    const caracteres = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };

    return caracteres[caractere];
  });
}

// ======================================================
// CHARGER LES UTILISATEURS
// ======================================================

async function chargerUtilisateurs() {
  try {
    const sessionResponse = await fetch("/api/session", {
      credentials: "include",
    });

    const session = await sessionResponse.json();

    if (!sessionResponse.ok || !session.connecte) {
      window.location.href = "/login.html";

      return;
    }

    if (session.utilisateur.role !== "admin") {
      window.location.href = "/index.html";

      return;
    }

    const response = await fetch(API, {
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Impossible de charger les utilisateurs.",
      );
    }

    afficherUtilisateurs(data);
  } catch (error) {
    console.error("Erreur utilisateurs :", error);

    liste.innerHTML = `
            <tr>
                <td colspan="5">
                    Impossible de charger les utilisateurs.
                </td>
            </tr>
        `;
  }
}

// ======================================================
// AFFICHER LES UTILISATEURS
// ======================================================

function afficherUtilisateurs(utilisateurs) {
  if (!Array.isArray(utilisateurs)) {
    utilisateurs = [];
  }

  compteur.textContent = `${utilisateurs.length} utilisateur${
    utilisateurs.length > 1 ? "s" : ""
  }`;

  if (utilisateurs.length === 0) {
    liste.innerHTML = `
            <tr>
                <td colspan="5">
                    Aucun utilisateur.
                </td>
            </tr>
        `;

    return;
  }

  liste.innerHTML = utilisateurs
    .map(function (utilisateur) {
      const roleAffiche =
        utilisateur.role === "admin" ? "Administrateur" : "Vendeur";

      const date = utilisateur.date_creation
        ? new Date(utilisateur.date_creation).toLocaleDateString("fr-FR")
        : "-";

      return `
                    <tr>

                        <td>
                            <strong>
                                ${protegerTexte(utilisateur.nom)}
                            </strong>
                        </td>


                        <td>
                            ${protegerTexte(utilisateur.email)}
                        </td>


                        <td>
                            <span class="status ${
                              utilisateur.role === "admin"
                                ? "success"
                                : "warning"
                            }">
                                ${roleAffiche}
                            </span>
                        </td>


                        <td>
                            ${date}
                        </td>


                        <td>

                            <button
                                class="icon-btn"
                                type="button"
                                onclick="modifierUtilisateur(${utilisateur.id})"
                            >
                                Modifier
                            </button>


                            <button
                                class="icon-btn danger-btn"
                                type="button"
                                onclick="supprimerUtilisateur(${utilisateur.id})"
                            >
                                Supprimer
                            </button>

                        </td>

                    </tr>
                `;
    })
    .join("");
}

// ======================================================
// NOUVEL UTILISATEUR
// ======================================================

document
  .getElementById("btnNouvelUtilisateur")
  .addEventListener("click", function () {
    utilisateurEnModification = null;

    formulaire.reset();

    motDePasse.required = true;

    zoneFormulaire.hidden = false;

    document.getElementById("titreFormulaire").textContent =
      "Ajouter un utilisateur";

    document.getElementById("btnEnregistrerUtilisateur").textContent =
      "Enregistrer";
  });

// ======================================================
// ANNULER
// ======================================================

document
  .getElementById("btnAnnulerUtilisateur")
  .addEventListener("click", function () {
    utilisateurEnModification = null;

    formulaire.reset();

    motDePasse.required = false;

    zoneFormulaire.hidden = true;
  });

// ======================================================
// MODIFIER
// ======================================================

window.modifierUtilisateur = async function (id) {
  try {
    const response = await fetch(API, {
      credentials: "include",
    });

    const utilisateurs = await response.json();

    const utilisateur = utilisateurs.find(function (element) {
      return element.id === id;
    });

    if (!utilisateur) {
      return;
    }

    utilisateurEnModification = id;

    nom.value = utilisateur.nom;

    email.value = utilisateur.email;

    role.value = utilisateur.role;

    motDePasse.value = "";

    motDePasse.required = false;

    zoneFormulaire.hidden = false;

    document.getElementById("titreFormulaire").textContent =
      "Modifier un utilisateur";

    document.getElementById("btnEnregistrerUtilisateur").textContent =
      "Enregistrer les modifications";

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  } catch (error) {
    console.error(error);

    alert("Impossible de modifier cet utilisateur.");
  }
};

// ======================================================
// SUPPRIMER
// ======================================================

window.supprimerUtilisateur = async function (id) {
  const confirmation = confirm(
    "Voulez-vous vraiment supprimer cet utilisateur ?",
  );

  if (!confirmation) {
    return;
  }

  try {
    const response = await fetch(`${API}/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Impossible de supprimer l'utilisateur.");
    }

    alert(data.message || "Utilisateur supprimé avec succès.");

    await chargerUtilisateurs();
  } catch (error) {
    console.error("Erreur suppression :", error);

    alert(error.message);
  }
};

// ======================================================
// ENREGISTRER
// ======================================================

formulaire.addEventListener("submit", async function (event) {
  event.preventDefault();

  const donnees = {
    nom: nom.value.trim(),

    email: email.value.trim(),

    role: role.value,
  };

  if (motDePasse.value.trim()) {
    donnees.mot_de_passe = motDePasse.value;
  }

  if (!utilisateurEnModification && !motDePasse.value.trim()) {
    alert("Veuillez saisir un mot de passe.");

    return;
  }

  try {
    let response;

    if (utilisateurEnModification) {
      response = await fetch(`${API}/${utilisateurEnModification}`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        credentials: "include",

        body: JSON.stringify(donnees),
      });
    } else {
      response = await fetch(API, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        credentials: "include",

        body: JSON.stringify({
          ...donnees,
          mot_de_passe: motDePasse.value,
        }),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Impossible d'enregistrer l'utilisateur.",
      );
    }

    alert(data.message || "Utilisateur enregistré avec succès.");

    formulaire.reset();

    zoneFormulaire.hidden = true;

    utilisateurEnModification = null;

    await chargerUtilisateurs();
  } catch (error) {
    console.error("Erreur enregistrement utilisateur :", error);

    alert(error.message);
  }
});

// ======================================================
// DÉMARRAGE
// ======================================================

chargerUtilisateurs();
