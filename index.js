const CLIENTS_API = "/api/clients";
const PRODUITS_API = "/api/produits";
const VENTES_API = "/api/ventes";
const SESSION_API = "/api/session";
const AUDIT_API = "/api/audit";

const nombreClients = document.getElementById("nombreClients");
const nombreProduits = document.getElementById("nombreProduits");
const nombreVentes = document.getElementById("nombreVentes");
const chiffreAffaires = document.getElementById("chiffreAffaires");

const listeActivite = document.getElementById("listeActivite");
const avatarUtilisateur = document.getElementById("avatarUtilisateur");

const welcomeSidebar = document.getElementById("welcomeSidebar");
const ouvrirMenu = document.getElementById("ouvrirMenu");

let utilisateurActuel = null;

/* =========================================================
   PROTECTION HTML
   ========================================================= */

function echapperHTML(valeur) {
  return String(valeur ?? "").replace(/[&<>"']/g, (caractere) => {
    const correspondances = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return correspondances[caractere];
  });
}

/* =========================================================
   INITIALISATION UTILISATEUR
   ========================================================= */

async function chargerSessionAccueil() {
  try {
    const response = await fetch(SESSION_API, {
      credentials: "include",
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || !data.connecte) {
      window.location.href = "/login.html";
      return null;
    }

    utilisateurActuel = data.utilisateur;

    if (avatarUtilisateur && utilisateurActuel.nom) {
      avatarUtilisateur.textContent = utilisateurActuel.nom
        .trim()
        .charAt(0)
        .toUpperCase();
    }

    return utilisateurActuel;
  } catch (error) {
    console.error("Erreur lors de la récupération de la session :", error);

    window.location.href = "/login.html";

    return null;
  }
}

/* =========================================================
   STATISTIQUES
   ========================================================= */

async function chargerStatistiquesAccueil() {
  try {
    const [clientsResponse, produitsResponse, ventesResponse] =
      await Promise.all([
        fetch(CLIENTS_API, {
          credentials: "include",
          cache: "no-store",
        }),

        fetch(PRODUITS_API, {
          credentials: "include",
          cache: "no-store",
        }),

        fetch(VENTES_API, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

    if (!clientsResponse.ok || !produitsResponse.ok || !ventesResponse.ok) {
      throw new Error("Impossible de récupérer les statistiques.");
    }

    const clients = await clientsResponse.json();
    const produits = await produitsResponse.json();
    const ventes = await ventesResponse.json();

    const totalChiffreAffaires = ventes.reduce((total, vente) => {
      return total + Number(vente.total || 0);
    }, 0);

    if (nombreClients) {
      nombreClients.textContent = clients.length;
    }

    if (nombreProduits) {
      nombreProduits.textContent = produits.length;
    }

    if (nombreVentes) {
      nombreVentes.textContent = ventes.length;
    }

    if (chiffreAffaires) {
      chiffreAffaires.textContent = `${totalChiffreAffaires.toFixed(2)} $`;
    }
  } catch (error) {
    console.error("Erreur statistiques accueil :", error);

    if (nombreClients) {
      nombreClients.textContent = "—";
    }

    if (nombreProduits) {
      nombreProduits.textContent = "—";
    }

    if (nombreVentes) {
      nombreVentes.textContent = "—";
    }

    if (chiffreAffaires) {
      chiffreAffaires.textContent = "—";
    }
  }
}

/* =========================================================
   ACTIVITÉ
   ========================================================= */

async function chargerActivite() {
  if (!listeActivite) {
    return;
  }

  try {
    /*
     * L'audit est réservé aux administrateurs.
     * Pour un vendeur, on affiche simplement son activité de session.
     */

    if (!utilisateurActuel || utilisateurActuel.role !== "admin") {
      listeActivite.innerHTML = `
                <div class="welcome-activity-row">

                    <div class="welcome-activity-icon">
                        ✓
                    </div>

                    <div class="welcome-activity-text">

                        <strong>
                            Session active
                        </strong>

                        <span>
                            Vous êtes connecté à MYSALES en tant que
                            ${echapperHTML(
                              utilisateurActuel?.role === "vendeur"
                                ? "vendeur"
                                : "utilisateur",
                            )}.
                        </span>

                    </div>

                </div>

                <div class="welcome-activity-row">

                    <div class="welcome-activity-icon">
                        ◈
                    </div>

                    <div class="welcome-activity-text">

                        <strong>
                            Espace commercial disponible
                        </strong>

                        <span>
                            Clients, produits, ventes et performances
                            sont accessibles depuis la navigation.
                        </span>

                    </div>

                </div>
            `;

      return;
    }

    const response = await fetch(`${AUDIT_API}?limit=50`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Impossible de récupérer l'audit.");
    }

    const audit = await response.json();

    const activitesConnexion = audit
      .filter((ligne) => {
        return ligne.action === "CONNEXION" || ligne.action === "DECONNEXION";
      })
      .slice(0, 5);

    if (!activitesConnexion.length) {
      listeActivite.innerHTML = `
                <div class="welcome-activity-row">

                    <div class="welcome-activity-icon">
                        ◌
                    </div>

                    <div class="welcome-activity-text">

                        <strong>
                            Aucune connexion récente
                        </strong>

                        <span>
                            Les prochaines activités apparaîtront ici.
                        </span>

                    </div>

                </div>
            `;

      return;
    }

    listeActivite.innerHTML = activitesConnexion
      .map((ligne) => {
        const connexion = ligne.action === "CONNEXION";

        const date = ligne.date_action
          ? new Date(ligne.date_action).toLocaleString("fr-FR")
          : "Date inconnue";

        const utilisateur = ligne.utilisateur || ligne.email || "Utilisateur";

        return `
                        <div class="welcome-activity-row">

                            <div class="welcome-activity-icon">
                                ${connexion ? "↗" : "↪"}
                            </div>

                            <div class="welcome-activity-text">

                                <strong>
                                    ${connexion ? "Connexion" : "Déconnexion"}
                                </strong>

                                <span>
                                    ${echapperHTML(utilisateur)}
                                    ·
                                    ${echapperHTML(date)}
                                </span>

                            </div>

                        </div>
                    `;
      })
      .join("");
  } catch (error) {
    console.error("Erreur activité accueil :", error);

    listeActivite.innerHTML = `
            <div class="welcome-activity-row">

                <div class="welcome-activity-icon">
                    !
                </div>

                <div class="welcome-activity-text">

                    <strong>
                        Activité momentanément indisponible
                    </strong>

                    <span>
                        L'espace principal reste fonctionnel.
                    </span>

                </div>

            </div>
        `;
  }
}

/* =========================================================
   DÉCONNEXION PROFESSIONNELLE
   ========================================================= */

async function deconnecterUtilisateur() {
  const bouton = document.getElementById("boutonDeconnexion");

  if (!bouton) {
    return;
  }

  const confirmation = window.confirm(
    "Voulez-vous vraiment fermer votre session MYSALES ?",
  );

  if (!confirmation) {
    return;
  }

  const texteOriginal = bouton.innerHTML;

  bouton.disabled = true;

  bouton.innerHTML = `
        <span>...</span>
        <span>Fermeture de session</span>
    `;

  try {
    const response = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("La déconnexion a échoué.");
    }

    window.location.href = "/login.html";
  } catch (error) {
    console.error("Erreur déconnexion :", error);

    bouton.disabled = false;
    bouton.innerHTML = texteOriginal;

    alert("Impossible de fermer la session. Veuillez réessayer.");
  }
}

/* =========================================================
   MENU MOBILE
   ========================================================= */

function initialiserMenuMobile() {
  if (!ouvrirMenu || !welcomeSidebar) {
    return;
  }

  ouvrirMenu.addEventListener("click", () => {
    welcomeSidebar.classList.toggle("open");
  });

  document.querySelectorAll(".welcome-navigation a").forEach((lien) => {
    lien.addEventListener("click", () => {
      if (window.innerWidth <= 800) {
        welcomeSidebar.classList.remove("open");
      }
    });
  });
}

/* =========================================================
   INITIALISATION
   ========================================================= */

async function initialiserAccueil() {
  const utilisateur = await chargerSessionAccueil();

  if (!utilisateur) {
    return;
  }

  await chargerStatistiquesAccueil();

  await chargerActivite();

  initialiserMenuMobile();

  const boutonDeconnexion = document.getElementById("boutonDeconnexion");

  if (boutonDeconnexion) {
    boutonDeconnexion.addEventListener("click", deconnecterUtilisateur);
  }

  /*
   * Actualisation légère de l'accueil.
   */

  setInterval(async () => {
    await chargerStatistiquesAccueil();

    if (utilisateurActuel && utilisateurActuel.role === "admin") {
      await chargerActivite();
    }
  }, 10000);
}

initialiserAccueil();
