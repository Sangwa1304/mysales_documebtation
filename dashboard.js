const CLIENTS_API = "/api/clients";
const PRODUITS_API = "/api/produits";
const VENTES_API = "/api/ventes";

const chiffreAffaires = document.getElementById("chiffreAffaires");
const nombreVentes = document.getElementById("nombreVentes");
const produitsVendus = document.getElementById("produitsVendus");
const nombreClients = document.getElementById("nombreClients");

const dashboardVentes = document.getElementById("dashboardVentes");
const dashboardStocks = document.getElementById("dashboardStocks");

const stockTotal = document.getElementById("stockTotal");
const stockFaible = document.getElementById("stockFaible");

const boutonActualiserDashboard = document.getElementById(
  "boutonActualiserDashboard",
);

let ventes = [];
let produits = [];
let clients = [];

let caChart = null;
let produitsChart = null;
let clientsChart = null;
let vendeursChart = null;
let ventesRepartitionChart = null;

// ======================================================
// PROTECTION HTML
// ======================================================

function echapperHTML(valeur) {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ======================================================
// PRODUITS D'UNE VENTE
// ======================================================

function obtenirProduitsVente(vente) {
  if (Array.isArray(vente.produits)) {
    return vente.produits;
  }

  return [];
}

// ======================================================
// CHARGEMENT
// ======================================================

async function chargerDonneesDashboard() {
  try {
    const [clientsResponse, produitsResponse, ventesResponse] =
      await Promise.all([
        fetch(CLIENTS_API, {
          credentials: "include",
        }),

        fetch(PRODUITS_API, {
          credentials: "include",
        }),

        fetch(VENTES_API, {
          credentials: "include",
        }),
      ]);

    if (!clientsResponse.ok || !produitsResponse.ok || !ventesResponse.ok) {
      throw new Error("Impossible de récupérer les données.");
    }

    clients = await clientsResponse.json();

    produits = await produitsResponse.json();

    ventes = await ventesResponse.json();

    calculerKPIs();

    afficherVentesRecentes();

    afficherStocks();

    afficherGraphiques();
  } catch (error) {
    console.error("Erreur dashboard :", error);

    afficherErreurDashboard(
      "Impossible de charger les données du tableau de bord.",
    );
  }
}

// ======================================================
// KPI
// ======================================================

function calculerKPIs() {
  const caTotal = ventes.reduce((total, vente) => {
    return total + Number(vente.total || 0);
  }, 0);

  chiffreAffaires.textContent = `${caTotal.toFixed(2)} $`;

  nombreVentes.textContent = ventes.length;

  let totalProduitsVendus = 0;

  ventes.forEach((vente) => {
    obtenirProduitsVente(vente).forEach((produit) => {
      totalProduitsVendus += Number(produit.quantite || 0);
    });
  });

  produitsVendus.textContent = totalProduitsVendus;

  nombreClients.textContent = clients.length;
}

// ======================================================
// VENTES RÉCENTES
// ======================================================

function afficherVentesRecentes() {
  dashboardVentes.innerHTML = "";

  if (ventes.length === 0) {
    dashboardVentes.innerHTML = `
            <tr>
                <td colspan="6">
                    Aucune vente enregistrée.
                </td>
            </tr>
        `;

    return;
  }

  const ventesRecentes = [...ventes]
    .sort((a, b) => new Date(b.date_vente || 0) - new Date(a.date_vente || 0))
    .slice(0, 10);

  ventesRecentes.forEach((vente) => {
    const produitsVente = obtenirProduitsVente(vente);

    const produitsTexte = produitsVente.length
      ? produitsVente
          .map(
            (produit) =>
              `${echapperHTML(produit.produit || "-")} × ${Number(
                produit.quantite || 0,
              )}`,
          )
          .join("<br>")
      : "-";

    const date = vente.date_vente
      ? new Date(vente.date_vente).toLocaleString("fr-FR")
      : "-";

    const ligne = document.createElement("tr");

    ligne.innerHTML = `
            <td>
                <strong>#${vente.id}</strong>
            </td>

            <td>
                ${echapperHTML(vente.client || "-")}
            </td>

            <td>
                ${produitsTexte}
            </td>

            <td>
                <strong>
                    ${Number(vente.total || 0).toFixed(2)} $
                </strong>
            </td>

            <td>
                ${echapperHTML(vente.vendeur || "-")}
            </td>

            <td>
                ${echapperHTML(date)}
            </td>
        `;

    dashboardVentes.appendChild(ligne);
  });
}

// ======================================================
// STOCK
// ======================================================

function afficherStocks() {
  dashboardStocks.innerHTML = "";

  if (!produits.length) {
    dashboardStocks.innerHTML = `
            <tr>
                <td colspan="4">
                    Aucun produit enregistré.
                </td>
            </tr>
        `;

    stockTotal.textContent = "0";

    stockFaible.textContent = "0";

    return;
  }

  const totalStock = produits.reduce(
    (total, produit) => total + Number(produit.stock || 0),
    0,
  );

  stockTotal.textContent = totalStock;

  const faibleStock = produits.filter(
    (produit) => Number(produit.stock || 0) <= 5,
  );

  stockFaible.textContent = faibleStock.length;

  produits.forEach((produit) => {
    const stock = Number(produit.stock || 0);

    let etat = "Disponible";

    if (stock === 0) {
      etat = "Rupture";
    } else if (stock <= 5) {
      etat = "Stock faible";
    }

    const ligne = document.createElement("tr");

    ligne.innerHTML = `
            <td>
                <strong>
                    ${echapperHTML(produit.nom || "-")}
                </strong>
            </td>

            <td>
                ${Number(produit.prix || 0).toFixed(2)} $
            </td>

            <td>
                ${stock}
            </td>

            <td>
                <span class="stock-status ${stock === 0 ? "rupture" : stock <= 5 ? "faible" : "ok"}">
                    ${etat}
                </span>
            </td>
        `;

    dashboardStocks.appendChild(ligne);
  });
}

// ======================================================
// GRAPHIQUES
// ======================================================

function afficherGraphiques() {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js n'est pas disponible.");

    return;
  }

  afficherGraphiqueCA();

  afficherGraphiqueProduits();

  afficherGraphiqueRepartition();

  afficherGraphiqueClients();

  afficherGraphiqueVendeurs();
}

// ======================================================
// OPTIONS COMMUNES
// ======================================================

function optionsGraphique() {
  return {
    responsive: true,

    maintainAspectRatio: false,

    interaction: {
      intersect: false,
      mode: "index",
    },

    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
          padding: 18,
          font: {
            size: 12,
            weight: "600",
          },
        },
      },

      tooltip: {
        padding: 12,

        titleFont: {
          size: 13,
          weight: "700",
        },

        bodyFont: {
          size: 12,
        },

        cornerRadius: 8,
      },
    },

    scales: {
      x: {
        grid: {
          display: false,
        },

        ticks: {
          maxRotation: 0,
        },
      },

      y: {
        beginAtZero: true,

        grid: {
          color: "rgba(13,27,61,.07)",
        },
      },
    },
  };
}

// ======================================================
// COURBE CHIFFRE D'AFFAIRES
// ======================================================

function afficherGraphiqueCA() {
  const canvas = document.getElementById("caChart");

  if (!canvas) {
    return;
  }

  const donnees = {};

  ventes.forEach((vente) => {
    if (!vente.date_vente) {
      return;
    }

    const date = new Date(vente.date_vente);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    const cle = date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });

    donnees[cle] = (donnees[cle] || 0) + Number(vente.total || 0);
  });

  const labels = Object.keys(donnees);

  const valeurs = labels.map((label) => donnees[label]);

  if (caChart) {
    caChart.destroy();
  }

  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, 330);

  gradient.addColorStop(0, "rgba(23,105,255,.25)");

  gradient.addColorStop(1, "rgba(23,105,255,0)");

  caChart = new Chart(canvas, {
    type: "line",

    data: {
      labels,

      datasets: [
        {
          label: "Chiffre d'affaires",

          data: valeurs,

          borderColor: "#1769ff",

          backgroundColor: gradient,

          borderWidth: 3,

          pointRadius: 3,

          pointHoverRadius: 6,

          pointBackgroundColor: "#1769ff",

          fill: true,

          tension: 0.4,
        },
      ],
    },

    options: {
      ...optionsGraphique(),

      plugins: {
        ...optionsGraphique().plugins,

        tooltip: {
          ...optionsGraphique().plugins.tooltip,

          callbacks: {
            label: (context) => ` ${Number(context.raw || 0).toFixed(2)} $`,
          },
        },
      },
    },
  });
}

// ======================================================
// BARRES PRODUITS
// ======================================================

function afficherGraphiqueProduits() {
  const canvas = document.getElementById("produitsChart");

  if (!canvas) {
    return;
  }

  const quantites = {};

  ventes.forEach((vente) => {
    obtenirProduitsVente(vente).forEach((produit) => {
      const nom = produit.produit || "Produit inconnu";

      quantites[nom] = (quantites[nom] || 0) + Number(produit.quantite || 0);
    });
  });

  const entries = Object.entries(quantites)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const labels = entries.map((entry) => entry[0]);

  const valeurs = entries.map((entry) => entry[1]);

  if (produitsChart) {
    produitsChart.destroy();
  }

  produitsChart = new Chart(canvas, {
    type: "bar",

    data: {
      labels,

      datasets: [
        {
          label: "Quantité vendue",

          data: valeurs,

          backgroundColor: "#1769ff",

          borderRadius: 8,

          borderSkipped: false,

          barThickness: 22,
        },
      ],
    },

    options: {
      ...optionsGraphique(),

      indexAxis: "y",

      plugins: {
        ...optionsGraphique().plugins,

        legend: {
          display: false,
        },
      },

      scales: {
        x: {
          beginAtZero: true,

          grid: {
            color: "rgba(13,27,61,.07)",
          },

          ticks: {
            precision: 0,
          },
        },

        y: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

// ======================================================
// 🍩 GRAPHIQUE EN ANNEAU
// ======================================================

function afficherGraphiqueRepartition() {
  const canvas = document.getElementById("ventesRepartitionChart");

  if (!canvas) {
    return;
  }

  const repartition = {};

  ventes.forEach((vente) => {
    obtenirProduitsVente(vente).forEach((produit) => {
      const nom = produit.produit || "Produit inconnu";

      repartition[nom] =
        (repartition[nom] || 0) + Number(produit.quantite || 0);
    });
  });

  const entries = Object.entries(repartition).sort((a, b) => b[1] - a[1]);

  const topEntries = entries.slice(0, 6);

  if (entries.length > 6) {
    const autres = entries
      .slice(6)
      .reduce((total, entry) => total + Number(entry[1]), 0);

    topEntries.push(["Autres", autres]);
  }

  const labels = topEntries.map((entry) => entry[0]);

  const valeurs = topEntries.map((entry) => entry[1]);

  if (ventesRepartitionChart) {
    ventesRepartitionChart.destroy();
  }

  ventesRepartitionChart = new Chart(canvas, {
    type: "doughnut",

    data: {
      labels,

      datasets: [
        {
          data: valeurs,

          backgroundColor: [
            "#1769ff",
            "#16a36a",
            "#7c3aed",
            "#f59e0b",
            "#e14d5b",
            "#0891b2",
            "#64748b",
          ],

          borderWidth: 3,

          borderColor: "#ffffff",

          hoverOffset: 8,
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      cutout: "68%",

      plugins: {
        legend: {
          position: "bottom",

          labels: {
            usePointStyle: true,

            pointStyle: "circle",

            padding: 15,

            font: {
              size: 11,
              weight: "600",
            },
          },
        },

        tooltip: {
          padding: 12,

          callbacks: {
            label: function (context) {
              const total = context.dataset.data.reduce(
                (somme, valeur) => somme + Number(valeur),
                0,
              );

              const valeur = Number(context.raw || 0);

              const pourcentage =
                total > 0 ? ((valeur / total) * 100).toFixed(1) : "0";

              return ` ${valeur} unités — ${pourcentage}%`;
            },
          },
        },
      },
    },
  });
}

// ======================================================
// CLIENTS
// ======================================================

function afficherGraphiqueClients() {
  const canvas = document.getElementById("clientsChart");

  if (!canvas) {
    return;
  }

  const donnees = {};

  clients.forEach((client) => {
    if (!client.date_creation) {
      return;
    }

    const date = new Date(client.date_creation);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    const cle = date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });

    donnees[cle] = (donnees[cle] || 0) + 1;
  });

  const labels = Object.keys(donnees);

  const valeurs = labels.map((label) => donnees[label]);

  if (clientsChart) {
    clientsChart.destroy();
  }

  clientsChart = new Chart(canvas, {
    type: "line",

    data: {
      labels,

      datasets: [
        {
          label: "Nouveaux clients",

          data: valeurs,

          borderColor: "#7c3aed",

          backgroundColor: "rgba(124,58,237,.10)",

          borderWidth: 3,

          pointRadius: 3,

          fill: true,

          tension: 0.4,
        },
      ],
    },

    options: {
      ...optionsGraphique(),

      plugins: {
        ...optionsGraphique().plugins,

        tooltip: {
          ...optionsGraphique().plugins.tooltip,

          callbacks: {
            label: (context) => ` ${context.raw} client(s)`,
          },
        },
      },
    },
  });
}

// ======================================================
// VENDEURS
// ======================================================

function afficherGraphiqueVendeurs() {
  const canvas = document.getElementById("vendeursChart");

  if (!canvas) {
    return;
  }

  const donnees = {};

  ventes.forEach((vente) => {
    const vendeur = vente.vendeur || "Vendeur inconnu";

    donnees[vendeur] = (donnees[vendeur] || 0) + Number(vente.total || 0);
  });

  const entries = Object.entries(donnees).sort((a, b) => b[1] - a[1]);

  const labels = entries.map((entry) => entry[0]);

  const valeurs = entries.map((entry) => entry[1]);

  if (vendeursChart) {
    vendeursChart.destroy();
  }

  vendeursChart = new Chart(canvas, {
    type: "bar",

    data: {
      labels,

      datasets: [
        {
          label: "Chiffre d'affaires",

          data: valeurs,

          backgroundColor: "#16a36a",

          borderRadius: 8,

          borderSkipped: false,

          barThickness: 26,
        },
      ],
    },

    options: {
      ...optionsGraphique(),

      plugins: {
        ...optionsGraphique().plugins,

        tooltip: {
          ...optionsGraphique().plugins.tooltip,

          callbacks: {
            label: (context) => ` ${Number(context.raw || 0).toFixed(2)} $`,
          },
        },
      },
    },
  });
}

// ======================================================
// ERREUR
// ======================================================

function afficherErreurDashboard(message) {
  if (dashboardVentes) {
    dashboardVentes.innerHTML = `
            <tr>
                <td colspan="6">
                    ${echapperHTML(message)}
                </td>
            </tr>
        `;
  }

  if (dashboardStocks) {
    dashboardStocks.innerHTML = `
            <tr>
                <td colspan="4">
                    ${echapperHTML(message)}
                </td>
            </tr>
        `;
  }
}

// ======================================================
// ACTUALISATION
// ======================================================

if (boutonActualiserDashboard) {
  boutonActualiserDashboard.addEventListener("click", async function () {
    boutonActualiserDashboard.disabled = true;

    const texte = boutonActualiserDashboard.innerHTML;

    boutonActualiserDashboard.innerHTML = "↻ Actualisation...";

    try {
      await chargerDonneesDashboard();
    } finally {
      boutonActualiserDashboard.disabled = false;

      boutonActualiserDashboard.innerHTML = texte;
    }
  });
}

// ======================================================
// DÉMARRAGE
// ======================================================

chargerDonneesDashboard();
