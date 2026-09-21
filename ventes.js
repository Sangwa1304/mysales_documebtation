const CLIENTS_API = "/api/clients";
const PRODUITS_API = "/api/produits";
const VENTES_API = "/api/ventes";

let clients = [];
let produits = [];
let ventes = [];
let panier = [];

/* =========================================================
   ÉLÉMENTS HTML
   ========================================================= */

const clientVente = document.getElementById("clientVente");

const rechercheProduit = document.getElementById("rechercheProduit");

const produitVente = document.getElementById("produitVente");

const quantiteVente = document.getElementById("quantiteVente");

const sousTotalVente = document.getElementById("sousTotalVente");

const prixProduit = document.getElementById("prixProduit");

const stockProduit = document.getElementById("stockProduit");

const informationProduit = document.getElementById("informationProduit");

const panierList = document.getElementById("panierList");

const totalVente = document.getElementById("totalVente");

const venteForm = document.getElementById("venteForm");

const ventesList = document.getElementById("ventesList");

const rechercheVente = document.getElementById("rechercheVente");

const boutonAjouterPanier = document.getElementById("boutonAjouterPanier");

const boutonActualiser = document.getElementById("boutonActualiser");

const nombreVentes = document.getElementById("nombreVentes");

const chiffreAffaires = document.getElementById("chiffreAffaires");

const modalVente = document.getElementById("modalVente");

const modalOverlay = document.getElementById("modalOverlay");

const fermerModalVente = document.getElementById("fermerModalVente");

const boutonFermerFacture = document.getElementById("boutonFermerFacture");

const boutonImprimerFacture = document.getElementById("boutonImprimerFacture");

const contenuFacture = document.getElementById("contenuFacture");

/* =========================================================
   OUTILS
   ========================================================= */

function formaterMontant(valeur) {
  const nombre = Number(valeur);

  if (!Number.isFinite(nombre)) {
    return "0.00 $";
  }

  return `${nombre.toFixed(2)} $`;
}

function formaterDate(date) {
  if (!date) {
    return "-";
  }

  const valeur = new Date(date);

  if (Number.isNaN(valeur.getTime())) {
    return date;
  }

  return valeur.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function echapperHTML(valeur) {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
   CHARGER LES CLIENTS
   ========================================================= */

async function chargerClients() {
  try {
    const response = await fetch(CLIENTS_API, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Impossible de charger les clients.");
    }

    clients = await response.json();

    clientVente.innerHTML = '<option value="">Sélectionnez un client</option>';

    clients.forEach((client) => {
      const option = document.createElement("option");

      option.value = client.id;

      option.textContent = `${client.nom_complet} - ${client.telephone || "Sans téléphone"}`;

      clientVente.appendChild(option);
    });
  } catch (error) {
    console.error("Erreur chargement clients :", error);

    clientVente.innerHTML = '<option value="">Erreur de chargement</option>';
  }
}

/* =========================================================
   CHARGER LES PRODUITS
   ========================================================= */

async function chargerProduits() {
  try {
    const response = await fetch(PRODUITS_API, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Impossible de charger les produits.");
    }

    produits = await response.json();

    afficherProduitsDansSelect();
  } catch (error) {
    console.error("Erreur chargement produits :", error);

    produitVente.innerHTML = '<option value="">Erreur de chargement</option>';
  }
}

/* =========================================================
   AFFICHER LES PRODUITS
   ========================================================= */

function afficherProduitsDansSelect() {
  const recherche = rechercheProduit.value.trim().toLowerCase();

  produitVente.innerHTML = '<option value="">Sélectionnez un produit</option>';

  produits
    .filter((produit) => {
      return String(produit.nom).toLowerCase().includes(recherche);
    })
    .forEach((produit) => {
      const option = document.createElement("option");

      option.value = produit.id;

      const quantiteDansPanier = obtenirQuantitePanier(produit.id);

      const stockDisponible = Number(produit.stock) - quantiteDansPanier;

      option.textContent = `${produit.nom} — ${formaterMontant(produit.prix)} — Stock : ${stockDisponible}`;

      option.dataset.prix = produit.prix;

      option.dataset.stock = stockDisponible;

      produitVente.appendChild(option);
    });

  afficherInformationProduit();
}

/* =========================================================
   QUANTITÉ D'UN PRODUIT DANS LE PANIER
   ========================================================= */

function obtenirQuantitePanier(produitId) {
  const ligne = panier.find(
    (item) => Number(item.produit_id) === Number(produitId),
  );

  return ligne ? Number(ligne.quantite) : 0;
}

/* =========================================================
   INFORMATIONS PRODUIT
   ========================================================= */

function afficherInformationProduit() {
  const produitId = produitVente.value;

  if (!produitId) {
    informationProduit.style.display = "none";

    prixProduit.textContent = "0.00 $";

    stockProduit.textContent = "0";

    sousTotalVente.value = "0.00 $";

    return;
  }

  const produit = produits.find(
    (item) => Number(item.id) === Number(produitId),
  );

  if (!produit) {
    informationProduit.style.display = "none";

    return;
  }

  const quantiteDansPanier = obtenirQuantitePanier(produit.id);

  const stockDisponible = Number(produit.stock) - quantiteDansPanier;

  informationProduit.style.display = "grid";

  prixProduit.textContent = formaterMontant(produit.prix);

  stockProduit.textContent = stockDisponible;

  calculerSousTotal();
}

/* =========================================================
   CALCUL SOUS-TOTAL
   ========================================================= */

function calculerSousTotal() {
  const produitId = produitVente.value;

  const quantite = Number(quantiteVente.value);

  if (!produitId || !Number.isInteger(quantite) || quantite <= 0) {
    sousTotalVente.value = "0.00 $";

    return;
  }

  const produit = produits.find(
    (item) => Number(item.id) === Number(produitId),
  );

  if (!produit) {
    sousTotalVente.value = "0.00 $";

    return;
  }

  const sousTotal = Number(produit.prix) * quantite;

  sousTotalVente.value = formaterMontant(sousTotal);
}

/* =========================================================
   AJOUTER AU PANIER
   ========================================================= */

function ajouterAuPanier() {
  const produitId = Number(produitVente.value);

  const quantite = Number(quantiteVente.value);

  if (!produitId) {
    alert("Veuillez sélectionner un produit.");

    return;
  }

  if (!Number.isInteger(quantite) || quantite <= 0) {
    alert("La quantité doit être un nombre entier supérieur à 0.");

    return;
  }

  const produit = produits.find((item) => Number(item.id) === produitId);

  if (!produit) {
    alert("Produit introuvable.");

    return;
  }

  const quantiteExistante = obtenirQuantitePanier(produitId);

  const nouvelleQuantite = quantiteExistante + quantite;

  if (nouvelleQuantite > Number(produit.stock)) {
    alert(
      `Stock insuffisant pour "${produit.nom}".\n\n` +
        `Stock disponible : ${Number(produit.stock) - quantiteExistante}`,
    );

    return;
  }

  const ligneExistante = panier.find(
    (item) => Number(item.produit_id) === produitId,
  );

  if (ligneExistante) {
    ligneExistante.quantite = nouvelleQuantite;
  } else {
    panier.push({
      produit_id: produitId,

      produit: produit.nom,

      prix_unitaire: Number(produit.prix),

      quantite: quantite,
    });
  }

  afficherPanier();

  produitVente.value = "";

  quantiteVente.value = 1;

  afficherProduitsDansSelect();
}

/* =========================================================
   AFFICHER PANIER
   ========================================================= */

function afficherPanier() {
  panierList.innerHTML = "";

  if (panier.length === 0) {
    panierList.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="ms-cart-empty"
        >
          Aucun produit dans le panier.
        </td>
      </tr>
    `;

    totalVente.textContent = "0.00 $";

    return;
  }

  let total = 0;

  panier.forEach((item, index) => {
    const sousTotal = Number(item.prix_unitaire) * Number(item.quantite);

    total += sousTotal;

    const tr = document.createElement("tr");

    tr.innerHTML = `

        <td>
          <strong>
            ${echapperHTML(item.produit)}
          </strong>
        </td>

        <td>
          ${formaterMontant(item.prix_unitaire)}
        </td>

        <td>
          ${Number(item.quantite)}
        </td>

        <td>
          <strong>
            ${formaterMontant(sousTotal)}
          </strong>
        </td>

        <td>

          <button
            type="button"
            class="ms-delete"
            onclick="supprimerDuPanier(${index})"
          >
            Supprimer
          </button>

        </td>

      `;

    panierList.appendChild(tr);
  });

  totalVente.textContent = formaterMontant(total);
}

/* =========================================================
   SUPPRIMER DU PANIER
   ========================================================= */

function supprimerDuPanier(index) {
  if (index < 0 || index >= panier.length) {
    return;
  }

  panier.splice(index, 1);

  afficherPanier();

  afficherProduitsDansSelect();
}

/* =========================================================
   ENREGISTRER UNE VENTE
   ========================================================= */

async function enregistrerVente(event) {
  event.preventDefault();

  if (!clientVente.value) {
    alert("Veuillez sélectionner un client.");

    return;
  }

  if (panier.length === 0) {
    alert("Veuillez ajouter au moins un produit dans le panier.");

    return;
  }

  const clientId = Number(clientVente.value);

  const produitsVente = panier.map((item) => ({
    produit_id: Number(item.produit_id),

    quantite: Number(item.quantite),
  }));

  try {
    const response = await fetch(VENTES_API, {
      method: "POST",

      credentials: "include",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        client_id: clientId,

        produits: produitsVente,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Impossible d'enregistrer la vente.");
    }

    alert("✓ Vente enregistrée avec succès.");

    panier = [];

    afficherPanier();

    venteForm.reset();

    quantiteVente.value = 1;

    await chargerProduits();

    await chargerVentes();
  } catch (error) {
    console.error("Erreur enregistrement vente :", error);

    alert(error.message || "Une erreur est survenue.");
  }
}

/* =========================================================
   CHARGER LES VENTES
   ========================================================= */

async function chargerVentes() {
  try {
    ventesList.innerHTML = `

      <tr>

        <td
          colspan="7"
          class="ms-cart-empty"
        >
          Chargement des ventes...
        </td>

      </tr>

    `;

    const response = await fetch(VENTES_API, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Impossible de charger les ventes.");
    }

    ventes = await response.json();

    afficherStatistiques();

    afficherVentes();
  } catch (error) {
    console.error("Erreur chargement ventes :", error);

    ventesList.innerHTML = `

      <tr>

        <td
          colspan="7"
          class="ms-cart-empty"
        >
          Impossible de charger les ventes.
        </td>

      </tr>

    `;
  }
}

/* =========================================================
   STATISTIQUES
   ========================================================= */

function afficherStatistiques() {
  nombreVentes.textContent = ventes.length;

  const chiffre = ventes.reduce(
    (total, vente) => total + Number(vente.total || 0),
    0,
  );

  chiffreAffaires.textContent = formaterMontant(chiffre);
}

/* =========================================================
   AFFICHER HISTORIQUE
   ========================================================= */

function afficherVentes() {
  const recherche = rechercheVente.value.trim().toLowerCase();

  const ventesFiltrees = ventes.filter((vente) => {
    const texte = [
      vente.id,

      vente.client,

      vente.vendeur,

      vente.date_vente,

      ...(vente.produits || []).map((produit) => produit.produit),
    ]
      .join(" ")
      .toLowerCase();

    return texte.includes(recherche);
  });

  ventesList.innerHTML = "";

  if (ventesFiltrees.length === 0) {
    ventesList.innerHTML = `

      <tr>

        <td
          colspan="7"
          class="ms-cart-empty"
        >
          Aucune vente trouvée.
        </td>

      </tr>

    `;

    return;
  }

  ventesFiltrees.forEach((vente) => {
    const tr = document.createElement("tr");

    const nombreProduits = Array.isArray(vente.produits)
      ? vente.produits.length
      : 0;

    tr.innerHTML = `

        <td>
          <span class="ms-sale-id">
            #${echapperHTML(vente.id)}
          </span>
        </td>


        <td>
          <span class="ms-sale-client">
            ${echapperHTML(vente.client || "Client inconnu")}
          </span>
        </td>


        <td>
          ${nombreProduits}
          produit${nombreProduits > 1 ? "s" : ""}
        </td>


        <td>
          <span class="ms-sale-total">
            ${formaterMontant(vente.total)}
          </span>
        </td>


        <td>
          ${echapperHTML(vente.vendeur || "—")}
        </td>


        <td>
          ${formaterDate(vente.date_vente)}
        </td>


        <td>

          <button
            type="button"
            class="ms-view"
            onclick="voirDetailsVente(${Number(vente.id)})"
          >
            Voir la facture
          </button>

        </td>

      `;

    ventesList.appendChild(tr);
  });
}

/* =========================================================
   AFFICHER FACTURE
   ========================================================= */

function voirDetailsVente(venteId) {
  const vente = ventes.find((item) => Number(item.id) === Number(venteId));

  if (!vente) {
    alert("Vente introuvable.");

    return;
  }

  const produitsFacture = Array.isArray(vente.produits) ? vente.produits : [];

  let lignesProduits = "";

  produitsFacture.forEach((produit) => {
    const quantite = Number(produit.quantite || 0);

    const prix = Number(produit.prix_unitaire || 0);

    const sousTotal = Number(produit.sous_total ?? prix * quantite);

    lignesProduits += `

        <tr>

          <td>
            <strong>
              ${echapperHTML(produit.produit || "Produit")}
            </strong>
          </td>

          <td class="ms-number">
            ${formaterMontant(prix)}
          </td>

          <td class="ms-number">
            ${quantite}
          </td>

          <td class="ms-number">
            <strong>
              ${formaterMontant(sousTotal)}
            </strong>
          </td>

        </tr>

      `;
  });

  contenuFacture.innerHTML = `


    <div class="ms-invoice-meta">


      <div class="ms-meta-box">

        <span>
          Numéro de facture
        </span>

        <strong>
          #${echapperHTML(vente.id)}
        </strong>

      </div>


      <div class="ms-meta-box">

        <span>
          Date
        </span>

        <strong>
          ${formaterDate(vente.date_vente)}
        </strong>

      </div>


      <div class="ms-meta-box">

        <span>
          Vendeur
        </span>

        <strong>
          ${echapperHTML(vente.vendeur || "—")}
        </strong>

      </div>


      <div class="ms-meta-box">

        <span>
          Client
        </span>

        <strong>
          ${echapperHTML(vente.client || "Client inconnu")}
        </strong>

      </div>


      <div class="ms-meta-box">

        <span>
          Type de document
        </span>

        <strong>
          Vente commerciale
        </strong>

      </div>


      <div class="ms-meta-box">

        <span>
          Statut
        </span>

        <strong>
          Vente enregistrée
        </strong>

      </div>


    </div>


    <table class="ms-invoice-table">

      <thead>

        <tr>

          <th>
            Produit
          </th>

          <th class="ms-number">
            Prix unitaire
          </th>

          <th class="ms-number">
            Quantité
          </th>

          <th class="ms-number">
            Sous-total
          </th>

        </tr>

      </thead>


      <tbody>

        ${
          lignesProduits ||
          `
            <tr>

              <td
                colspan="4"
                style="
                  text-align:center;
                  color:#71809d;
                  padding:25px;
                "
              >
                Aucun produit.
              </td>

            </tr>
          `
        }

      </tbody>

    </table>


    <div class="ms-invoice-total">

      <span>
        Total général
      </span>

      <strong>
        ${formaterMontant(vente.total)}
      </strong>

    </div>


    <div class="ms-invoice-footer">

      <span>
        MYSALES — Gestion commerciale
      </span>

      <span>
        Facture générée automatiquement
      </span>

    </div>


  `;

  ouvrirFacture();
}

/* =========================================================
   OUVRIR FACTURE
   ========================================================= */

function ouvrirFacture() {
  modalVente.classList.add("visible");

  modalVente.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
}

/* =========================================================
   FERMER FACTURE
   ========================================================= */

function fermerFacture() {
  modalVente.classList.remove("visible");

  modalVente.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";
}

/* =========================================================
   IMPRESSION
   ========================================================= */

function imprimerFacture() {
  window.print();
}

/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */

if (boutonAjouterPanier) {
  boutonAjouterPanier.addEventListener("click", ajouterAuPanier);
}

if (venteForm) {
  venteForm.addEventListener("submit", enregistrerVente);
}

if (produitVente) {
  produitVente.addEventListener("change", afficherInformationProduit);
}

if (quantiteVente) {
  quantiteVente.addEventListener("input", calculerSousTotal);
}

if (rechercheProduit) {
  rechercheProduit.addEventListener("input", afficherProduitsDansSelect);
}

if (rechercheVente) {
  rechercheVente.addEventListener("input", afficherVentes);
}

if (boutonActualiser) {
  boutonActualiser.addEventListener("click", async () => {
    await chargerClients();

    await chargerProduits();

    await chargerVentes();
  });
}

if (fermerModalVente) {
  fermerModalVente.addEventListener("click", fermerFacture);
}

if (boutonFermerFacture) {
  boutonFermerFacture.addEventListener("click", fermerFacture);
}

if (modalOverlay) {
  modalOverlay.addEventListener("click", fermerFacture);
}

if (boutonImprimerFacture) {
  boutonImprimerFacture.addEventListener("click", imprimerFacture);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalVente.classList.contains("visible")) {
    fermerFacture();
  }
});

/* =========================================================
   INITIALISATION
   ========================================================= */

async function initialiserVentes() {
  await chargerClients();

  await chargerProduits();

  afficherPanier();

  await chargerVentes();
}

initialiserVentes();
