const API_VENTES = "/api/ventes";

function escapeHtml(value) {
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

function formaterDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function obtenirId() {
  const params = new URLSearchParams(window.location.search);

  return params.get("id");
}

async function chargerFacture() {
  const conteneur = document.getElementById("conteneurFacture");

  const id = obtenirId();

  if (!id) {
    conteneur.innerHTML = `
            <div class="facture-document">
                <h2>Facture introuvable</h2>
                <p>
                    Aucun numéro de vente n'a été fourni.
                </p>
            </div>
        `;

    return;
  }

  try {
    const response = await fetch(API_VENTES, {
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";

      return;
    }

    if (!response.ok) {
      throw new Error("Erreur lors du chargement des ventes.");
    }

    const ventes = await response.json();

    const vente = ventes.find((element) => String(element.id) === String(id));

    if (!vente) {
      conteneur.innerHTML = `
                <div class="facture-document">
                    <h2>Facture introuvable</h2>
                    <p>
                        La vente #${escapeHtml(id)}
                        n'existe pas.
                    </p>
                </div>
            `;

      return;
    }

    afficherFacture(vente);
  } catch (error) {
    console.error(error);

    conteneur.innerHTML = `
            <div class="facture-document">
                <h2>Erreur</h2>
                <p>
                    Impossible de charger la facture.
                </p>
            </div>
        `;
  }
}

function afficherFacture(vente) {
  const numero = `FAC-${String(vente.id).padStart(5, "0")}`;

  const produits = Array.isArray(vente.produits) ? vente.produits : [];

  const lignes = produits.length
    ? produits
        .map(
          (produit) => `

                    <tr>

                        <td>
                            ${escapeHtml(produit.produit)}
                        </td>

                        <td>
                            ${escapeHtml(produit.quantite)}
                        </td>

                        <td class="text-right">
                            ${escapeHtml(
                              formaterMontant(produit.prix_unitaire),
                            )}
                        </td>

                        <td class="text-right">
                            ${escapeHtml(formaterMontant(produit.sous_total))}
                        </td>

                    </tr>

                `,
        )
        .join("")
    : `
                <tr>
                    <td colspan="4">
                        Aucun détail disponible.
                    </td>
                </tr>
            `;

  const conteneur = document.getElementById("conteneurFacture");

  conteneur.innerHTML = `

        <article class="facture-document">

            <header class="facture-header">

                <div class="facture-brand">

                    <div class="facture-logo">
                        M
                    </div>

                    <div>

                        <strong>
                            MYSALES
                        </strong>

                        <span>
                            Gestion commerciale
                        </span>

                    </div>

                </div>


                <div class="facture-title">

                    <h1>
                        FACTURE
                    </h1>

                    <p>
                        ${numero}
                    </p>

                    <p>
                        ${escapeHtml(formaterDate(vente.date_vente))}
                    </p>

                </div>

            </header>


            <section class="facture-infos">

                <div class="facture-info">

                    <small>
                        Facturé à
                    </small>

                    <strong>
                        ${escapeHtml(vente.client || "Client")}
                    </strong>

                </div>


                <div class="facture-info">

                    <small>
                        Vendeur
                    </small>

                    <strong>
                        ${escapeHtml(vente.vendeur || "—")}
                    </strong>

                    <span>
                        Vente n° ${numero}
                    </span>

                </div>

            </section>


            <table class="facture-table">

                <thead>

                    <tr>

                        <th>
                            Produit
                        </th>

                        <th>
                            Quantité
                        </th>

                        <th class="text-right">
                            Prix unitaire
                        </th>

                        <th class="text-right">
                            Total
                        </th>

                    </tr>

                </thead>

                <tbody>

                    ${lignes}

                </tbody>

            </table>


            <div class="facture-total">

                <div class="facture-total-line">

                    <span>
                        Sous-total
                    </span>

                    <strong>
                        ${formaterMontant(vente.total)}
                    </strong>

                </div>


                <div class="facture-total-line">

                    <span>
                        Remise
                    </span>

                    <strong>
                        0,00 $
                    </strong>

                </div>


                <div class="facture-total-line facture-total-final">

                    <span>
                        TOTAL
                    </span>

                    <strong>
                        ${formaterMontant(vente.total)}
                    </strong>

                </div>

            </div>


            <footer class="facture-footer">

                Merci pour votre confiance.

                <br>

                MYSALES — Solution de gestion commerciale

            </footer>

        </article>
    `;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("boutonImprimer").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("boutonRetour").addEventListener("click", () => {
    window.location.href = "/dashboard.html";
  });

  chargerFacture();
});
