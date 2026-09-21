const API_VENTES = "/api/ventes";

let toutesLesVentes = [];

function echapperHTML(valeur) {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formaterMontant(montant) {
  const valeur = Number(montant || 0);

  return (
    valeur.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " $"
  );
}

function formaterDate(date) {
  if (!date) {
    return "—";
  }

  const valeur = new Date(date);

  if (Number.isNaN(valeur.getTime())) {
    return String(date);
  }

  return valeur.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function obtenirIdVente(vente) {
  return vente.id ?? vente.vente_id ?? vente.id_vente;
}

function obtenirClient(vente) {
  if (typeof vente.client === "string") {
    return vente.client;
  }

  if (vente.client?.nom_complet) {
    return vente.client.nom_complet;
  }

  if (vente.client?.nom) {
    return vente.client.nom;
  }

  if (vente.client_nom) {
    return vente.client_nom;
  }

  if (vente.nom_client) {
    return vente.nom_client;
  }

  return "Client non renseigné";
}

function obtenirVendeur(vente) {
  if (typeof vente.vendeur === "string") {
    return vente.vendeur;
  }

  if (vente.vendeur?.nom) {
    return vente.vendeur.nom;
  }

  if (vente.utilisateur?.nom) {
    return vente.utilisateur.nom;
  }

  if (vente.utilisateur_nom) {
    return vente.utilisateur_nom;
  }

  return "—";
}

function obtenirDateVente(vente) {
  return (
    vente.date_vente || vente.date || vente.created_at || vente.date_creation
  );
}

function obtenirTotal(vente) {
  return Number(vente.total ?? vente.montant_total ?? vente.total_vente ?? 0);
}

function obtenirNomFacture(id) {
  return `FAC-${String(id).padStart(5, "0")}`;
}

function afficherMessage(message, type = "error") {
  const element = document.getElementById("messageFacturation");

  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = `message-facturation ${type}`;

  setTimeout(() => {
    element.className = "message-facturation";
    element.textContent = "";
  }, 4000);
}

async function chargerVentes() {
  const liste = document.getElementById("listeFactures");
  const vide = document.getElementById("factureVide");
  const nombre = document.getElementById("nombreFactures");

  try {
    liste.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:35px;">
                    Chargement des factures...
                </td>
            </tr>
        `;

    const response = await fetch(API_VENTES, {
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!response.ok) {
      throw new Error("Impossible de récupérer les ventes.");
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      toutesLesVentes = data;
    } else if (Array.isArray(data.ventes)) {
      toutesLesVentes = data.ventes;
    } else if (Array.isArray(data.rows)) {
      toutesLesVentes = data.rows;
    } else {
      toutesLesVentes = [];
    }

    afficherFactures();
  } catch (error) {
    console.error("Erreur facturation :", error);

    liste.innerHTML = "";

    vide.style.display = "block";

    afficherMessage(
      "Impossible de charger les factures. Vérifiez que le serveur MYSALES fonctionne.",
      "error",
    );
  }
}

function afficherFactures() {
  const liste = document.getElementById("listeFactures");
  const vide = document.getElementById("factureVide");
  const nombre = document.getElementById("nombreFactures");

  liste.innerHTML = "";

  const ventes = [...toutesLesVentes].sort((a, b) => {
    const dateA = new Date(obtenirDateVente(a) || 0).getTime();
    const dateB = new Date(obtenirDateVente(b) || 0).getTime();

    return dateB - dateA;
  });

  nombre.textContent = `${ventes.length} facture${ventes.length > 1 ? "s" : ""}`;

  if (ventes.length === 0) {
    vide.style.display = "block";
    return;
  }

  vide.style.display = "none";

  ventes.forEach((vente) => {
    const id = obtenirIdVente(vente);

    if (!id) {
      return;
    }

    const ligne = document.createElement("tr");

    ligne.innerHTML = `
            <td>
                <span class="facture-numero">
                    ${echapperHTML(obtenirNomFacture(id))}
                </span>
            </td>

            <td>
                <span class="facture-date">
                    ${echapperHTML(formaterDate(obtenirDateVente(vente)))}
                </span>
            </td>

            <td>
                <span class="facture-client">
                    ${echapperHTML(obtenirClient(vente))}
                </span>
            </td>

            <td>
                ${echapperHTML(obtenirVendeur(vente))}
            </td>

            <td>
                <span class="facture-total">
                    ${echapperHTML(formaterMontant(obtenirTotal(vente)))}
                </span>
            </td>

            <td>
                <span class="etat-facturation">
                    Payée
                </span>
            </td>

            <td>
                <button
                    type="button"
                    class="btn-facture"
                    data-vente-id="${echapperHTML(id)}"
                >
                    Voir la facture
                </button>
            </td>
        `;

    liste.appendChild(ligne);
  });

  document.querySelectorAll(".btn-facture").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const id = bouton.dataset.venteId;

      window.location.href = `facture.html?id=${encodeURIComponent(id)}`;
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const boutonActualiser = document.getElementById("boutonActualiser");

  if (boutonActualiser) {
    boutonActualiser.addEventListener("click", async () => {
      await chargerVentes();
    });
  }

  chargerVentes();
});
