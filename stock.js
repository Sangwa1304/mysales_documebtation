const PRODUITS_API = "/api/produits";
const MOUVEMENTS_API = "/api/mouvements-stock";

let produits = [];
let mouvements = [];

const nombreProduits = document.getElementById("nombreProduits");
const stockTotal = document.getElementById("stockTotal");
const stockFaible = document.getElementById("stockFaible");
const stockRupture = document.getElementById("stockRupture");

const rechercheStock = document.getElementById("rechercheStock");
const filtreStock = document.getElementById("filtreStock");
const filtreMouvement = document.getElementById("filtreMouvement");
const stockList = document.getElementById("stockList");
const boutonActualiser = document.getElementById("boutonActualiser");


// ======================================================
// CHARGER LES PRODUITS
// ======================================================

async function chargerProduits() {

    try {

        const response = await fetch(PRODUITS_API, {
            credentials: "include"
        });

        if (!response.ok) {

            if (response.status === 401) {
                window.location.href = "/login.html";
                return;
            }

            throw new Error("Erreur lors du chargement des produits");
        }

        produits = await response.json();

        console.log("Produits récupérés :", produits);

        afficherStatistiques();
        afficherStock();

    } catch (erreur) {

        console.error("Erreur produits :", erreur);

        stockList.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Impossible de charger les produits.
                </td>
            </tr>
        `;
    }
}


// ======================================================
// CHARGER LES MOUVEMENTS
// ======================================================

async function chargerMouvements() {

    try {

        const response = await fetch(MOUVEMENTS_API, {
            credentials: "include"
        });

        if (!response.ok) {

            console.warn(
                "Les mouvements de stock ne sont pas disponibles."
            );

            mouvements = [];
            return;
        }

        mouvements = await response.json();

        console.log("Mouvements récupérés :", mouvements);

    } catch (erreur) {

        console.warn(
            "Impossible de charger les mouvements :",
            erreur
        );

        mouvements = [];
    }
}


// ======================================================
// STATISTIQUES
// ======================================================

function afficherStatistiques() {

    const totalProduits = produits.length;

    const totalStock = produits.reduce(
        (total, produit) =>
            total + Number(produit.stock || 0),
        0
    );

    const produitsFaibles = produits.filter(
        produit => {

            const stock = Number(produit.stock || 0);

            return stock > 0 && stock <= 5;
        }
    ).length;

    const produitsRupture = produits.filter(
        produit =>
            Number(produit.stock || 0) <= 0
    ).length;


    nombreProduits.textContent = totalProduits;
    stockTotal.textContent = totalStock;
    stockFaible.textContent = produitsFaibles;
    stockRupture.textContent = produitsRupture;
}


// ======================================================
// ÉTAT DU STOCK
// ======================================================

function obtenirEtatStock(stock) {

    stock = Number(stock || 0);

    if (stock <= 0) {

        return {
            texte: "Rupture",
            classe: "stock-rupture"
        };
    }

    if (stock <= 5) {

        return {
            texte: "Stock faible",
            classe: "stock-faible"
        };
    }

    return {
        texte: "Normal",
        classe: "stock-ok"
    };
}


// ======================================================
// DERNIER MOUVEMENT
// ======================================================

function obtenirDernierMouvement(produitId) {

    const mouvementsProduit = mouvements
        .filter(
            mouvement =>
                Number(mouvement.produit_id) === Number(produitId)
        )
        .sort(
            (a, b) =>
                new Date(b.date_mouvement) -
                new Date(a.date_mouvement)
        );

    if (mouvementsProduit.length === 0) {

        return {
            type: "—",
            date: "—"
        };
    }

    const dernier = mouvementsProduit[0];

    return {
        type: dernier.type_mouvement || "—",
        date: dernier.date_mouvement
            ? new Date(
                dernier.date_mouvement
              ).toLocaleString("fr-FR")
            : "—"
    };
}


// ======================================================
// AFFICHER LE STOCK
// ======================================================

function afficherStock() {

    const recherche =
        rechercheStock.value
            .trim()
            .toLowerCase();

    const etatSelectionne =
        filtreStock.value;

    const mouvementSelectionne =
        filtreMouvement.value;


    const produitsFiltres =
        produits.filter(produit => {

            const nom =
                String(produit.nom || "")
                    .toLowerCase();

            const stock =
                Number(produit.stock || 0);

            const etat =
                obtenirEtatStock(stock);


            // Recherche
            if (
                recherche &&
                !nom.includes(recherche)
            ) {
                return false;
            }


            // Filtre état
            if (
                etatSelectionne === "normal" &&
                stock <= 5
            ) {
                return false;
            }

            if (
                etatSelectionne === "faible" &&
                !(stock > 0 && stock <= 5)
            ) {
                return false;
            }

            if (
                etatSelectionne === "rupture" &&
                stock > 0
            ) {
                return false;
            }


            // Filtre mouvement
            if (
                mouvementSelectionne !== "tous"
            ) {

                const dernier =
                    obtenirDernierMouvement(
                        produit.id
                    );

                if (
                    dernier.type !==
                    mouvementSelectionne
                ) {
                    return false;
                }
            }


            return true;
        });


    // Aucun résultat
    if (produitsFiltres.length === 0) {

        stockList.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Aucun produit trouvé.
                </td>
            </tr>
        `;

        return;
    }


    // Affichage
    stockList.innerHTML =
        produitsFiltres.map(produit => {

            const stock =
                Number(produit.stock || 0);

            const prix =
                Number(produit.prix || 0);

            const etat =
                obtenirEtatStock(stock);

            const mouvement =
                obtenirDernierMouvement(
                    produit.id
                );


            return `
                <tr>

                    <td>
                        <strong>
                            ${echapperHTML(
                                produit.nom || "Produit"
                            )}
                        </strong>
                    </td>

                    <td>
                        ${prix.toLocaleString(
                            "fr-FR"
                        )} $
                    </td>

                    <td>
                        <strong>
                            ${stock}
                        </strong>
                    </td>

                    <td>
                        <span class="${etat.classe}">
                            ${etat.texte}
                        </span>
                    </td>

                    <td>
                        ${mouvement.type}
                    </td>

                    <td>
                        ${mouvement.date}
                    </td>

                </tr>
            `;

        }).join("");
}


// ======================================================
// PROTECTION HTML
// ======================================================

function echapperHTML(valeur) {

    return String(valeur)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ======================================================
// ACTUALISER
// ======================================================

async function actualiserStock() {

    if (boutonActualiser) {

        boutonActualiser.disabled = true;
        boutonActualiser.textContent =
            "Actualisation...";
    }

    await chargerMouvements();
    await chargerProduits();

    if (boutonActualiser) {

        boutonActualiser.disabled = false;
        boutonActualiser.textContent =
            "Actualiser";
    }
}


// ======================================================
// FILTRES
// ======================================================

if (rechercheStock) {

    rechercheStock.addEventListener(
        "input",
        afficherStock
    );
}

if (filtreStock) {

    filtreStock.addEventListener(
        "change",
        afficherStock
    );
}

if (filtreMouvement) {

    filtreMouvement.addEventListener(
        "change",
        afficherStock
    );
}

if (boutonActualiser) {

    boutonActualiser.addEventListener(
        "click",
        actualiserStock
    );
}


// ======================================================
// INITIALISATION
// ======================================================

async function initialiserStock() {

    console.log(
        "Initialisation de la page Stock..."
    );

    await chargerMouvements();
    await chargerProduits();
}

initialiserStock();
