const API = "/api/produits";

let produits = [];

let produitEnEdition = null;

/* =========================================================
   UTILITAIRES
   ========================================================= */

function echapperHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formaterMontant(value) {
  return (
    Number(value || 0).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " $"
  );
}

/* =========================================================
   GÉNÉRATEUR DE VISUEL PRODUIT
   ========================================================= */

function determinerCategorie(nom) {
  const texte = String(nom || "").toLowerCase();

  if (
    texte.includes("ordinateur") ||
    texte.includes("laptop") ||
    texte.includes("pc") ||
    texte.includes("macbook")
  ) {
    return {
      emoji: "💻",
      titre: "TECH",
    };
  }

  if (
    texte.includes("telephone") ||
    texte.includes("téléphone") ||
    texte.includes("smartphone") ||
    texte.includes("iphone") ||
    texte.includes("samsung")
  ) {
    return {
      emoji: "📱",
      titre: "MOBILE",
    };
  }

  if (
    texte.includes("casque") ||
    texte.includes("écouteur") ||
    texte.includes("ecouteur") ||
    texte.includes("airpods")
  ) {
    return {
      emoji: "🎧",
      titre: "AUDIO",
    };
  }

  if (
    texte.includes("souris") ||
    texte.includes("clavier") ||
    texte.includes("keyboard")
  ) {
    return {
      emoji: "🖱️",
      titre: "ACCESSOIRE",
    };
  }

  if (texte.includes("imprimante") || texte.includes("printer")) {
    return {
      emoji: "🖨️",
      titre: "BUREAUTIQUE",
    };
  }

  if (texte.includes("chaussure") || texte.includes("basket")) {
    return {
      emoji: "👟",
      titre: "MODE",
    };
  }

  if (
    texte.includes("chemise") ||
    texte.includes("pantalon") ||
    texte.includes("robe") ||
    texte.includes("vêtement") ||
    texte.includes("vetement")
  ) {
    return {
      emoji: "👕",
      titre: "MODE",
    };
  }

  if (texte.includes("montre")) {
    return {
      emoji: "⌚",
      titre: "ACCESSOIRE",
    };
  }

  if (texte.includes("sac") || texte.includes("cartable")) {
    return {
      emoji: "🎒",
      titre: "ACCESSOIRE",
    };
  }

  if (
    texte.includes("chaise") ||
    texte.includes("table") ||
    texte.includes("bureau")
  ) {
    return {
      emoji: "🪑",
      titre: "MOBILIER",
    };
  }

  return {
    emoji: "📦",
    titre: "PRODUIT",
  };
}

function couleurPourProduit(nom) {
  let hash = 0;

  const texte = String(nom || "");

  for (let i = 0; i < texte.length; i++) {
    hash = texte.charCodeAt(i) + ((hash << 5) - hash);
  }

  const couleurs = [
    ["#2563eb", "#0f172a"],

    ["#7c3aed", "#312e81"],

    ["#0891b2", "#164e63"],

    ["#059669", "#064e3b"],

    ["#ea580c", "#7c2d12"],

    ["#db2777", "#831843"],

    ["#4f46e5", "#1e1b4b"],
  ];

  return couleurs[Math.abs(hash) % couleurs.length];
}

function genererVisuelProduit(nom) {
  const categorie = determinerCategorie(nom);

  const couleurs = couleurPourProduit(nom);

  const nomCourt = String(nom || "Produit").substring(0, 28);

  const svg = `

        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="800"
            height="600"
            viewBox="0 0 800 600"
        >

            <defs>

                <linearGradient
                    id="fond"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                >

                    <stop
                        offset="0%"
                        stop-color="${couleurs[0]}"
                    />

                    <stop
                        offset="100%"
                        stop-color="${couleurs[1]}"
                    />

                </linearGradient>

                <filter
                    id="ombre"
                    x="-30%"
                    y="-30%"
                    width="160%"
                    height="160%"
                >

                    <feDropShadow
                        dx="0"
                        dy="18"
                        stdDeviation="18"
                        flood-color="#000000"
                        flood-opacity=".25"
                    />

                </filter>

            </defs>


            <rect
                width="800"
                height="600"
                rx="40"
                fill="url(#fond)"
            />


            <circle
                cx="680"
                cy="100"
                r="130"
                fill="#ffffff"
                opacity=".08"
            />

            <circle
                cx="100"
                cy="530"
                r="170"
                fill="#ffffff"
                opacity=".06"
            />


            <text
                x="60"
                y="85"
                fill="#ffffff"
                font-family="Arial"
                font-size="26"
                font-weight="700"
                letter-spacing="4"
            >
                MYSALES
            </text>


            <text
                x="60"
                y="125"
                fill="#ffffff"
                opacity=".75"
                font-family="Arial"
                font-size="16"
                font-weight="700"
                letter-spacing="3"
            >
                ${categorie.titre}
            </text>


            <text
                x="400"
                y="360"
                text-anchor="middle"
                font-size="180"
                filter="url(#ombre)"
            >
                ${categorie.emoji}
            </text>


            <rect
                x="60"
                y="485"
                width="680"
                height="70"
                rx="18"
                fill="#ffffff"
                opacity=".13"
            />


            <text
                x="400"
                y="530"
                text-anchor="middle"
                fill="#ffffff"
                font-family="Arial"
                font-size="27"
                font-weight="800"
            >
                ${echapperHTML(nomCourt)}
            </text>

        </svg>
    `;

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

/* =========================================================
   APERÇU
   ========================================================= */

function actualiserApercu() {
  const input = document.getElementById("nomProduit");

  const preview = document.getElementById("produitPreview");

  if (!input || !preview) {
    return;
  }

  const nom = input.value.trim();

  if (!nom) {
    preview.innerHTML = `
            <div class="produit-preview-label">
                Le visuel du produit
                sera généré automatiquement.
            </div>
        `;

    return;
  }

  const image = genererVisuelProduit(nom);

  preview.innerHTML = `
        <img
            src="${image}"
            alt="Visuel généré de ${echapperHTML(nom)}"
        >
    `;
}

/* =========================================================
   CHARGEMENT
   ========================================================= */

async function chargerProduits() {
  const liste = document.getElementById("produitsList");

  try {
    const response = await fetch(API, {
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";

      return;
    }

    if (!response.ok) {
      throw new Error("Impossible de charger les produits.");
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      produits = data;
    } else if (Array.isArray(data.produits)) {
      produits = data.produits;
    } else if (Array.isArray(data.rows)) {
      produits = data.rows;
    } else {
      produits = [];
    }

    afficherProduits();
  } catch (error) {
    console.error("Erreur produits :", error);

    liste.innerHTML = `
            <tr>
                <td colspan="5">
                    Impossible de charger les produits.
                </td>
            </tr>
        `;
  }
}

/* =========================================================
   AFFICHAGE
   ========================================================= */

function afficherProduits() {
  const liste = document.getElementById("produitsList");

  const recherche = (document.getElementById("rechercheProduit")?.value || "")
    .trim()
    .toLowerCase();

  const filtre = document.getElementById("filtreStock")?.value || "";

  const resultat = produits.filter((produit) => {
    const nom = String(produit.nom || "").toLowerCase();

    const description = String(produit.description || "").toLowerCase();

    const stock = Number(produit.stock || 0);

    const correspondRecherche =
      !recherche || nom.includes(recherche) || description.includes(recherche);

    let correspondFiltre = true;

    if (filtre === "ok") {
      correspondFiltre = stock > 5;
    } else if (filtre === "faible") {
      correspondFiltre = stock > 0 && stock <= 5;
    } else if (filtre === "rupture") {
      correspondFiltre = stock === 0;
    }

    return correspondRecherche && correspondFiltre;
  });

  const compteur = document.getElementById("compteurProduits");

  compteur.textContent = `${resultat.length} produit${resultat.length > 1 ? "s" : ""}`;

  if (resultat.length === 0) {
    liste.innerHTML = `
            <tr>
                <td colspan="5">
                    Aucun produit trouvé.
                </td>
            </tr>
        `;

    return;
  }

  liste.innerHTML = resultat
    .map((produit) => {
      const stock = Number(produit.stock || 0);

      let statut = "En stock";

      let classe = "badge-success";

      if (stock === 0) {
        statut = "Rupture";

        classe = "badge-danger";
      } else if (stock <= 5) {
        statut = "Stock faible";

        classe = "badge-warning";
      }

      const image = genererVisuelProduit(produit.nom);

      return `

                <tr>

                    <td>

                        <div class="produit-cell">

                            <div
                                class="produit-mini-image"
                            >

                                <img
                                    src="${image}"
                                    alt="${echapperHTML(produit.nom)}"
                                >

                            </div>

                            <div
                                class="produit-cell-info"
                            >

                                <strong>
                                    ${echapperHTML(produit.nom)}
                                </strong>

                                <small>
                                    ${echapperHTML(
                                      produit.description ||
                                        "Produit commercial",
                                    )}
                                </small>

                            </div>

                        </div>

                    </td>


                    <td>
                        ${echapperHTML(formaterMontant(produit.prix))}
                    </td>


                    <td>
                        <strong>
                            ${stock}
                        </strong>
                    </td>


                    <td>

                        <span
                            class="${classe}"
                        >
                            ${statut}
                        </span>

                    </td>


                    <td class="admin-only">

                        <button
                            class="btn btn-light btn-edit"
                            data-id="${produit.id}"
                        >
                            Modifier
                        </button>

                        <button
                            class="btn btn-light btn-stock"
                            data-id="${produit.id}"
                        >
                            Stock
                        </button>

                        <button
                            class="btn btn-light btn-delete"
                            data-id="${produit.id}"
                        >
                            Supprimer
                        </button>

                    </td>

                </tr>

            `;
    })
    .join("");

  connecterActionsProduits();
}

/* =========================================================
   ACTIONS
   ========================================================= */

function connecterActionsProduits() {
  document.querySelectorAll(".btn-edit").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id);

      ouvrirEdition(id);
    });
  });

  document.querySelectorAll(".btn-delete").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id);

      supprimerProduit(id);
    });
  });

  document.querySelectorAll(".btn-stock").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id);

      if (typeof ouvrirGestionStock === "function") {
        ouvrirGestionStock(id);
      } else {
        window.location.href = "stock.html";
      }
    });
  });
}

/* =========================================================
   FORMULAIRE
   ========================================================= */

function ouvrirFormulaire() {
  const form = document.getElementById("adminForm");

  if (!form) {
    return;
  }

  form.hidden = false;

  produitEnEdition = null;

  document.getElementById("titreFormulaireProduit").textContent =
    "Ajouter un produit";

  document.getElementById("boutonProduit").textContent = "Enregistrer";

  document.getElementById("produitForm").reset();

  actualiserApercu();

  window.scrollTo({
    top: form.offsetTop - 20,
    behavior: "smooth",
  });
}

function fermerFormulaire() {
  const form = document.getElementById("adminForm");

  if (!form) {
    return;
  }

  form.hidden = true;

  produitEnEdition = null;

  document.getElementById("produitForm").reset();

  actualiserApercu();
}

function ouvrirEdition(id) {
  const produit = produits.find((item) => Number(item.id) === Number(id));

  if (!produit) {
    return;
  }

  const form = document.getElementById("adminForm");

  form.hidden = false;

  produitEnEdition = produit.id;

  document.getElementById("titreFormulaireProduit").textContent =
    "Modifier le produit";

  document.getElementById("boutonProduit").textContent =
    "Enregistrer les modifications";

  document.getElementById("nomProduit").value = produit.nom || "";

  document.getElementById("descriptionProduit").value =
    produit.description || "";

  document.getElementById("prixProduit").value = produit.prix ?? "";

  document.getElementById("stockProduit").value = produit.stock ?? 0;

  actualiserApercu();

  window.scrollTo({
    top: form.offsetTop - 20,
    behavior: "smooth",
  });
}

async function enregistrerProduit(event) {
  event.preventDefault();

  const nom = document.getElementById("nomProduit").value.trim();

  const description = document
    .getElementById("descriptionProduit")
    .value.trim();

  const prix = Number(document.getElementById("prixProduit").value);

  const stock = Number(document.getElementById("stockProduit").value);

  if (!nom) {
    alert("Le nom du produit est obligatoire.");

    return;
  }

  if (!Number.isFinite(prix) || prix < 0) {
    alert("Le prix du produit est invalide.");

    return;
  }

  if (!Number.isInteger(stock) || stock < 0) {
    alert("Le stock doit être un nombre entier positif.");

    return;
  }

  const bouton = document.getElementById("boutonProduit");

  bouton.disabled = true;

  try {
    let response;

    if (produitEnEdition) {
      response = await fetch(`${API}/${produitEnEdition}`, {
        method: "PUT",

        credentials: "include",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          nom,
          description,
          prix,
          stock,
        }),
      });
    } else {
      response = await fetch(API, {
        method: "POST",

        credentials: "include",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          nom,
          description,
          prix,
          stock,
        }),
      });
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Impossible d'enregistrer le produit.");
    }

    alert(
      produitEnEdition
        ? "Produit modifié avec succès."
        : "Produit ajouté avec succès.",
    );

    fermerFormulaire();

    await chargerProduits();
  } catch (error) {
    console.error("Erreur enregistrement produit :", error);

    alert(error.message || "Une erreur est survenue.");
  } finally {
    bouton.disabled = false;
  }
}

/* =========================================================
   SUPPRESSION
   ========================================================= */

async function supprimerProduit(id) {
  const produit = produits.find((item) => Number(item.id) === Number(id));

  if (!produit) {
    return;
  }

  const confirmation = confirm(
    `Voulez-vous vraiment supprimer le produit "${produit.nom}" ?`,
  );

  if (!confirmation) {
    return;
  }

  try {
    const response = await fetch(`${API}/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Impossible de supprimer le produit.");
    }

    await chargerProduits();
  } catch (error) {
    console.error("Erreur suppression :", error);

    alert(error.message || "Erreur lors de la suppression.");
  }
}

/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const boutonNouveau = document.getElementById("btnNouveauProduit");

  const boutonAnnuler = document.getElementById("boutonAnnuler");

  const formulaire = document.getElementById("produitForm");

  const recherche = document.getElementById("rechercheProduit");

  const filtre = document.getElementById("filtreStock");

  const nom = document.getElementById("nomProduit");

  if (boutonNouveau) {
    boutonNouveau.addEventListener("click", ouvrirFormulaire);
  }

  if (boutonAnnuler) {
    boutonAnnuler.addEventListener("click", fermerFormulaire);
  }

  if (formulaire) {
    formulaire.addEventListener("submit", enregistrerProduit);
  }

  if (nom) {
    nom.addEventListener("input", actualiserApercu);
  }

  if (recherche) {
    recherche.addEventListener("input", afficherProduits);
  }

  if (filtre) {
    filtre.addEventListener("change", afficherProduits);
  }

  chargerProduits();
});
