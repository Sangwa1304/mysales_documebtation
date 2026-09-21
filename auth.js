const nomUtilisateur = document.getElementById("nomUtilisateur");

const roleUtilisateur = document.getElementById("roleUtilisateur");

const boutonDeconnexion = document.getElementById("boutonDeconnexion");

window.roleActuel = null;

/* =========================================================
   CHARGER L'UTILISATEUR CONNECTÉ
   ========================================================= */

async function chargerUtilisateur() {
  try {
    const response = await fetch("/api/session", {
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok || !data.connecte) {
      window.location.href = "/login.html";

      return;
    }

    window.roleActuel = data.utilisateur.role;

    if (nomUtilisateur) {
      nomUtilisateur.textContent = data.utilisateur.nom;
    }

    if (roleUtilisateur) {
      roleUtilisateur.textContent =
        data.utilisateur.role === "admin" ? "Administrateur" : "Vendeur";
    }

    /* =================================================
           AFFICHER / MASQUER LES ÉLÉMENTS ADMIN
           ================================================= */

    document.querySelectorAll(".admin-only").forEach((element) => {
      element.style.display = data.utilisateur.role === "admin" ? "" : "none";
    });

    /* =================================================
           NAVIGATION
           ================================================= */

    const nav =
      document.getElementById("mainNav") ||
      document.querySelector("header nav");

    if (nav && data.utilisateur.role === "admin") {
      const auditExiste = nav.querySelector(
        'a[href="/audit.html"], a[href="audit.html"]',
      );

      if (!auditExiste) {
        const lienAudit = document.createElement("a");

        lienAudit.href = "audit.html";

        lienAudit.textContent = "Audit";

        nav.appendChild(lienAudit);
      }

      const utilisateursExiste = nav.querySelector(
        'a[href="/utilisateurs.html"], a[href="utilisateurs.html"]',
      );

      if (!utilisateursExiste) {
        const lienUtilisateurs = document.createElement("a");

        lienUtilisateurs.href = "utilisateurs.html";

        lienUtilisateurs.textContent = "Utilisateurs";

        nav.appendChild(lienUtilisateurs);
      }
    }
  } catch (error) {
    console.error("Erreur chargement utilisateur :", error);

    window.location.href = "/login.html";
  }
}

/* =========================================================
   DÉCONNEXION
   ========================================================= */

if (boutonDeconnexion) {
  boutonDeconnexion.addEventListener("click", async () => {
    const confirmation = confirm("Voulez-vous vous déconnecter ?");

    if (!confirmation) {
      return;
    }

    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Erreur déconnexion :", error);
    } finally {
      window.location.href = "/login.html";
    }
  });
}

/* =========================================================
   DÉMARRAGE
   ========================================================= */

chargerUtilisateur();
