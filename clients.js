const API = "/api/clients";

const form = document.getElementById("clientForm");

const zoneFormulaire = document.getElementById("formulaireClient");

const liste = document.getElementById("clientsList");

const recherche = document.getElementById("rechercheClient");

const compteur = document.getElementById("compteurClients");

let clients = [];

let clientEnModification = null;

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
// FORMAT DATE
// ======================================================

function formaterDate(date) {
  if (!date) {
    return "-";
  }

  return new Date(date).toLocaleDateString("fr-FR");
}

// ======================================================
// CHARGER CLIENTS
// ======================================================

async function chargerClients() {
  try {
    const response = await fetch(API, {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";

      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Impossible de charger les clients.");
    }

    clients = Array.isArray(data) ? data : [];

    afficherClients();
  } catch (error) {
    console.error("Erreur clients :", error);

    liste.innerHTML = `
            <tr>
                <td colspan="6">
                    Impossible de charger les clients.
                </td>
            </tr>
        `;
  }
}

// ======================================================
// AFFICHER CLIENTS
// ======================================================

function afficherClients() {
  const rechercheTexte = recherche.value.trim().toLowerCase();

  const clientsFiltres = clients.filter(function (client) {
    return (
      !rechercheTexte ||
      String(client.nom_complet || "")
        .toLowerCase()
        .includes(rechercheTexte) ||
      String(client.telephone || "")
        .toLowerCase()
        .includes(rechercheTexte) ||
      String(client.email || "")
        .toLowerCase()
        .includes(rechercheTexte) ||
      String(client.ville || "")
        .toLowerCase()
        .includes(rechercheTexte)
    );
  });

  compteur.textContent = `${clientsFiltres.length} client${
    clientsFiltres.length > 1 ? "s" : ""
  }`;

  if (clientsFiltres.length === 0) {
    liste.innerHTML = `
            <tr>
                <td colspan="6">
                    Aucun client trouvé.
                </td>
            </tr>
        `;

    return;
  }

  liste.innerHTML = clientsFiltres
    .map(function (client) {
      return `
                        <tr>

                            <td>
                                <strong>
                                    ${protegerTexte(client.nom_complet)}
                                </strong>
                            </td>

                            <td>
                                ${protegerTexte(client.telephone)}
                            </td>

                            <td>
                                ${protegerTexte(client.email || "-")}
                            </td>

                            <td>
                                ${protegerTexte(client.ville || "-")}
                            </td>

                            <td>
                                ${formaterDate(client.date_creation)}
                            </td>

                            <td>

                                <button
                                    class="icon-btn"
                                    type="button"
                                    onclick="modifierClient(${client.id})"
                                >
                                    Modifier
                                </button>

                                <button
                                    class="icon-btn danger-btn"
                                    type="button"
                                    onclick="supprimerClient(${client.id})"
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
// NOUVEAU CLIENT
// ======================================================

document
  .getElementById("btnNouveauClient")
  .addEventListener("click", function () {
    clientEnModification = null;

    form.reset();

    zoneFormulaire.hidden = false;

    document.getElementById("titreFormulaireClient").textContent =
      "Ajouter un client";

    document.getElementById("btnEnregistrerClient").textContent = "Enregistrer";
  });

// ======================================================
// ANNULER
// ======================================================

document
  .getElementById("btnAnnulerClient")
  .addEventListener("click", function () {
    clientEnModification = null;

    form.reset();

    zoneFormulaire.hidden = true;
  });

// ======================================================
// MODIFIER
// ======================================================

window.modifierClient = function (id) {
  const client = clients.find(function (element) {
    return element.id === id;
  });

  if (!client) {
    return;
  }

  clientEnModification = id;

  document.getElementById("nomClient").value = client.nom_complet || "";

  document.getElementById("telephoneClient").value = client.telephone || "";

  document.getElementById("emailClient").value = client.email || "";

  document.getElementById("villeClient").value = client.ville || "";

  zoneFormulaire.hidden = false;

  document.getElementById("titreFormulaireClient").textContent =
    "Modifier un client";

  document.getElementById("btnEnregistrerClient").textContent =
    "Enregistrer les modifications";

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

// ======================================================
// SUPPRIMER
// ======================================================

window.supprimerClient = async function (id) {
  const confirmation = confirm("Voulez-vous vraiment supprimer ce client ?");

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
      throw new Error(data.message || "Impossible de supprimer le client.");
    }

    alert(data.message || "Client supprimé avec succès.");

    await chargerClients();
  } catch (error) {
    console.error("Erreur suppression client :", error);

    alert(error.message);
  }
};

// ======================================================
// ENREGISTRER
// ======================================================

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const donnees = {
    nom_complet: document.getElementById("nomClient").value.trim(),

    telephone: document.getElementById("telephoneClient").value.trim(),

    email: document.getElementById("emailClient").value.trim(),

    ville: document.getElementById("villeClient").value.trim(),
  };

  if (!donnees.nom_complet) {
    alert("Veuillez saisir le nom du client.");

    return;
  }

  if (!donnees.telephone) {
    alert("Veuillez saisir le numéro de téléphone.");

    return;
  }

  try {
    let response;

    if (clientEnModification) {
      response = await fetch(`${API}/${clientEnModification}`, {
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

        body: JSON.stringify(donnees),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Impossible d'enregistrer le client.");
    }

    alert(data.message || "Client enregistré avec succès.");

    clientEnModification = null;

    form.reset();

    zoneFormulaire.hidden = true;

    await chargerClients();
  } catch (error) {
    console.error("Erreur enregistrement client :", error);

    alert(error.message);
  }
});

// ======================================================
// RECHERCHE
// ======================================================

recherche.addEventListener("input", afficherClients);

// ======================================================
// DÉMARRAGE
// ======================================================

chargerClients();
