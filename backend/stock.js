const PRODUITS_API = "/api/produits";
const MOUVEMENTS_API = "/api/mouvements-stock";

let produits = [];
let mouvements = [];

const stockList = document.getElementById("stockList");
const rechercheStock = document.getElementById("rechercheStock");
const filtreStock = document.getElementById("filtreStock");
const filtreMouvement = document.getElementById("filtreMouvement");

const compteurStock = document.getElementById("compteurStock");

const kpiProduits = document.getElementById("kpiProduits");
const kpiStockTotal = document.getElementById("kpiStockTotal");
const kpiStockFaible = document.getElementById("kpiStockFaible");
const kpiRuptures = document.getElementById("kpiRuptures");

const boutonActualiserStock = document.getElementById("boutonActualiserStock");

/* =====================================================
   OUTILS
   ===================================================== */

function formaterMontant(montant) {
  return `${Number(montant || 0).toFixed(2)} $`;
}

function formaterDate(date) {
  if (!date) {
    return "-";
  }

  return new Date(date).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function echapperHTML(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );
}

/* =====================================================
   STATUT STOCK
   ===================================================== */

function obtenirStatutStock(stock) {
  const valeur = Number(stock);

  if (valeur === 0) {
    return {
      label: "Rupture",
      classe: "stock-rupture",
    };
  }

  if (valeur <= 5) {
    return {
      label: "Stock faible",
      classe: "stock-faible",
    };
  }

  return {
    label: "En stock",
    classe: "stock-normal",
  };
}

/* =====================================================
   CHARGER PRODUITS
   ===================================================== */

async function chargerProduits() {
  try {
    const response = await fetch(PRODUITS_API, {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!response.ok) {
      throw new Error("Impossible de récupérer les produits.");
    }

    produits = await response.json();
  } catch (error) {
    console.error("Erreur produits :", error);

    stockList.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="error-stock"
        >
          Impossible de charger le stock.
        </td>
      </tr>
    `;
  }
}

/* =====================================================
   CHARGER MOUVEMENTS
   ===================================================== */

async function chargerMouvements() {
  try {
    const response = await fetch(MOUVEMENTS_API, {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (response.status === 403) {
      alert("Cette page est réservée à l'administrateur.");

      window.location.href = "/index.html";

      return;
    }

    if (!response.ok) {
      throw new Error("Impossible de récupérer les mouvements.");
    }

    mouvements = await response.json();
  } catch (error) {
    console.error("Erreur mouvements :", error);

    mouvements = [];
  }
}

/* =====================================================
   DERNIER MOUVEMENT D'UN PRODUIT
   ===================================================== */

function obtenirDernierMouvement(produitId) {
  const mouvementsProduit = mouvements.filter(
    (mouvement) => Number(mouvement.produit_id) === Number(produitId),
  );

  if (!mouvementsProduit.length) {
    return null;
  }

  return mouvementsProduit[0];
}

/* =====================================================
   LIBELLÉ MOUVEMENT
   ===================================================== */

function obtenirLibelleMouvement(type) {
  switch (type) {
    case "entree":
      return "Entrée";

    case "sortie":
      return "Sortie";

    case "vente":
      return "Vente";

    case "ajustement":
      return "Ajustement";

    default:
      return type || "-";
  }
}

/* =====================================================
   CLASSE MOUVEMENT
   ===================================================== */

function obtenirClasseMouvement(type) {
  switch (type) {
    case "entree":
      return "movement-entry";

    case "sortie":
      return "movement-exit";

    case "vente":
      return "movement-sale";

    case "ajustement":
      return "movement-adjustment";

    default:
      return "";
  }
}

/* =====================================================
   KPI
   ===================================================== */

function afficherKPI() {
  const nombreProduits = produits.length;

  const stockTotal = produits.reduce(
    (total, produit) => total + Number(produit.stock || 0),
    0,
  );

  const stockFaible = produits.filter(
    (produit) => Number(produit.stock) > 0 && Number(produit.stock) <= 5,
  ).length;

  const ruptures = produits.filter(
    (produit) => Number(produit.stock) === 0,
  ).length;

  kpiProduits.textContent = nombreProduits;

  kpiStockTotal.textContent = stockTotal;

  kpiStockFaible.textContent = stockFaible;

  kpiRuptures.textContent = ruptures;
}

/* =====================================================
   AFFICHER STOCK
   ===================================================== */

function afficherStock() {
  const recherche = rechercheStock.value.trim().toLowerCase();

  const filtre = filtreStock.value;

  const filtreMouvementActuel = filtreMouvement.value;

  let liste = produits.filter((produit) => {
    const nom = String(produit.nom || "").toLowerCase();

    const description = String(produit.description || "").toLowerCase();

    const correspondRecherche =
      !recherche || nom.includes(recherche) || description.includes(recherche);

    const stock = Number(produit.stock || 0);

    let correspondStock = true;

    if (filtre === "normal") {
      correspondStock = stock > 5;
    }

    if (filtre === "faible") {
      correspondStock = stock > 0 && stock <= 5;
    }

    if (filtre === "rupture") {
      correspondStock = stock === 0;
    }

    let correspondMouvement = true;

    if (filtreMouvementActuel) {
      const dernier = obtenirDernierMouvement(produit.id);

      correspondMouvement =
        dernier && dernier.type_mouvement === filtreMouvementActuel;
    }

    return correspondRecherche && correspondStock && correspondMouvement;
  });

  compteurStock.textContent = `${liste.length} produit${liste.length > 1 ? "s" : ""}`;

  if (!liste.length) {
    stockList.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="empty-stock"
        >
          Aucun produit ne correspond aux critères.
        </td>
      </tr>
    `;

    return;
  }

  stockList.innerHTML = liste
    .map((produit) => {
      const statut = obtenirStatutStock(Number(produit.stock));

      const dernier = obtenirDernierMouvement(produit.id);

      let mouvementHTML = `<span>-</span>`;

      if (dernier) {
        const classe = obtenirClasseMouvement(dernier.type_mouvement);

        const libelle = obtenirLibelleMouvement(dernier.type_mouvement);

        const signe =
          dernier.type_mouvement === "entree"
            ? "+"
            : dernier.type_mouvement === "sortie" ||
                dernier.type_mouvement === "vente"
              ? "-"
              : "";

        mouvementHTML = `
          <span class="${classe}">
            ${signe}${dernier.quantite}
            ${libelle}
          </span>
        `;
      }

      return `
        <tr>

          <td>

            <span class="stock-product-name">
              ${echapperHTML(produit.nom)}
            </span>

            <span class="stock-product-description">
              ${echapperHTML(produit.description || "Aucune description")}
            </span>

          </td>


          <td>
            ${formaterMontant(produit.prix)}
          </td>


          <td>

            <strong>
              ${Number(produit.stock || 0)}
            </strong>

          </td>


          <td>

            <span
              class="stock-status ${statut.classe}"
            >
              ${statut.label}
            </span>

          </td>


          <td>
            ${mouvementHTML}
          </td>


          <td>
            ${dernier ? formaterDate(dernier.date_mouvement) : "-"}
          </td>

        </tr>
      `;
    })
    .join("");
}

/* =====================================================
   ACTUALISATION
   ===================================================== */

async function actualiserStock() {
  boutonActualiserStock.disabled = true;

  boutonActualiserStock.textContent = "Actualisation...";

  try {
    await Promise.all([chargerProduits(), chargerMouvements()]);

    afficherKPI();
    afficherStock();
  } finally {
    boutonActualiserStock.disabled = false;

    boutonActualiserStock.textContent = "Actualiser";
  }
}

/* =====================================================
   ÉVÉNEMENTS
   ===================================================== */

rechercheStock.addEventListener("input", afficherStock);

filtreStock.addEventListener("change", afficherStock);

filtreMouvement.addEventListener("change", afficherStock);

boutonActualiserStock.addEventListener("click", actualiserStock);

/* =====================================================
   INITIALISATION
   ===================================================== */

async function initialiserStock() {
  await chargerProduits();

  await chargerMouvements();

  afficherKPI();

  afficherStock();
}

initialiserStock();
