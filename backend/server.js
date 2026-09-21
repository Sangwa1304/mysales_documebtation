const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND = path.resolve(__dirname, "..");

// ======================================================
// MIDDLEWARES
// ======================================================

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.set("trust proxy", 1);

app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

// ======================================================
// AUTHENTIFICATION
// ======================================================

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      message: "Accès non autorisé. Veuillez vous connecter.",
    });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      message: "Accès non autorisé. Veuillez vous connecter.",
    });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({
      message: "Accès interdit. Réservé à l'administrateur.",
    });
  }

  next();
}

function requirePageAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  next();
}

function requireAdminPage(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  if (req.session.user.role !== "admin") {
    return res.redirect("/index.html");
  }

  next();
}

// ======================================================
// BASE DE DONNÉES
// ======================================================

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id SERIAL PRIMARY KEY,
      nom VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      mot_de_passe VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'vendeur'
        CHECK (role IN ('admin','vendeur')),
      date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      nom_complet VARCHAR(150) NOT NULL,
      telephone VARCHAR(30) NOT NULL UNIQUE,
      email VARCHAR(150),
      ville VARCHAR(100),
      date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS produits (
      id SERIAL PRIMARY KEY,
      nom VARCHAR(150) NOT NULL,
      description TEXT,
      prix NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ventes (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL
        REFERENCES clients(id)
        ON DELETE RESTRICT,
      date_vente TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      total NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (total >= 0),
      utilisateur_id INTEGER
        REFERENCES utilisateurs(id)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS details_vente (
      id SERIAL PRIMARY KEY,
      vente_id INTEGER NOT NULL
        REFERENCES ventes(id)
        ON DELETE CASCADE,
      produit_id INTEGER NOT NULL
        REFERENCES produits(id)
        ON DELETE RESTRICT,
      quantite INTEGER NOT NULL
        CHECK (quantite > 0),
      prix_unitaire NUMERIC(12,2) NOT NULL
        CHECK (prix_unitaire >= 0)
    );

    CREATE TABLE IF NOT EXISTS mouvements_stock (
      id SERIAL PRIMARY KEY,
      produit_id INTEGER NOT NULL
        REFERENCES produits(id)
        ON DELETE CASCADE,
      utilisateur_id INTEGER NOT NULL
        REFERENCES utilisateurs(id)
        ON DELETE RESTRICT,
      type_mouvement VARCHAR(30) NOT NULL
        CHECK (
          type_mouvement IN (
            'entree',
            'sortie',
            'ajustement',
            'vente'
          )
        ),
      quantite INTEGER NOT NULL,
      stock_avant INTEGER NOT NULL,
      stock_apres INTEGER NOT NULL,
      motif VARCHAR(255),
      date_mouvement TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      utilisateur_id INTEGER NOT NULL
        REFERENCES utilisateurs(id)
        ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expire_at TIMESTAMP NOT NULL,
      utilise BOOLEAN NOT NULL DEFAULT FALSE,
      date_creation TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      utilisateur_id INTEGER
        REFERENCES utilisateurs(id)
        ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      methode VARCHAR(10) NOT NULL,
      route VARCHAR(255) NOT NULL,
      statut_http INTEGER NOT NULL,
      details JSONB,
      adresse_ip VARCHAR(100),
      user_agent TEXT,
      date_action TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ventes_client
      ON ventes(client_id);

    CREATE INDEX IF NOT EXISTS idx_details_vente
      ON details_vente(vente_id);

    CREATE INDEX IF NOT EXISTS idx_details_produit
      ON details_vente(produit_id);

    CREATE INDEX IF NOT EXISTS idx_mouvements_stock_produit
      ON mouvements_stock(produit_id);

    CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash
      ON password_reset_tokens(token_hash);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_utilisateur
      ON audit_logs(utilisateur_id);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_date
      ON audit_logs(date_action);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_action
      ON audit_logs(action);
  `);

  await pool.query(`
    ALTER TABLE ventes
    ADD COLUMN IF NOT EXISTS utilisateur_id
    INTEGER REFERENCES utilisateurs(id)
    ON DELETE RESTRICT
  `);

  await pool.query(
    `
      UPDATE ventes
      SET utilisateur_id = (
        SELECT id
        FROM utilisateurs
        WHERE email = $1
        LIMIT 1
      )
      WHERE utilisateur_id IS NULL
    `,
    [process.env.ADMIN_EMAIL || "admin@mysales.com"],
  );

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@mysales.com")
    .trim()
    .toLowerCase();

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminPassword && adminPassword.length >= 8) {
    const existing = await pool.query(
      "SELECT id FROM utilisateurs WHERE email = $1",
      [adminEmail],
    );

    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 12);

      await pool.query(
        `
          INSERT INTO utilisateurs
          (nom, email, mot_de_passe, role)
          VALUES ($1, $2, $3, 'admin')
        `,
        [process.env.ADMIN_NAME || "Administrateur", adminEmail, hash],
      );

      console.log("Compte administrateur initial créé.");
    }
  }
}

// ======================================================
// MAIL
// ======================================================

function getMailer() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

// ======================================================
// AUDIT — DÉTERMINATION DE L'ACTION
// ======================================================

function determinerAction(req) {
  const route = req.originalUrl.split("?")[0];

  if (route === "/api/login") {
    return "CONNEXION";
  }

  if (route === "/api/logout") {
    return "DECONNEXION";
  }

  if (route === "/api/forgot-password") {
    return "DEMANDE_REINITIALISATION";
  }

  if (route === "/api/reset-password") {
    return "REINITIALISATION_MOT_DE_PASSE";
  }

  if (route.includes("/api/utilisateurs")) {
    if (req.method === "POST") {
      return "CREATION_UTILISATEUR";
    }

    if (req.method === "PUT") {
      return "MODIFICATION_UTILISATEUR";
    }

    if (req.method === "DELETE") {
      return "SUPPRESSION_UTILISATEUR";
    }

    if (req.method === "GET") {
      return "CONSULTATION_UTILISATEURS";
    }
  }

  if (route.includes("/api/clients")) {
    if (req.method === "POST") {
      return "CREATION_CLIENT";
    }

    if (req.method === "PUT") {
      return "MODIFICATION_CLIENT";
    }

    if (req.method === "DELETE") {
      return "SUPPRESSION_CLIENT";
    }

    if (req.method === "GET") {
      return "CONSULTATION_CLIENTS";
    }
  }

  if (route.includes("/api/produits") && route.endsWith("/stock")) {
    return "MODIFICATION_STOCK";
  }

  if (route.includes("/api/produits")) {
    if (req.method === "POST") {
      return "CREATION_PRODUIT";
    }

    if (req.method === "PUT") {
      return "MODIFICATION_PRODUIT";
    }

    if (req.method === "DELETE") {
      return "SUPPRESSION_PRODUIT";
    }

    if (req.method === "GET") {
      return "CONSULTATION_PRODUITS";
    }
  }

  if (route === "/api/ventes" && req.method === "POST") {
    return "CREATION_VENTE";
  }

  if (route === "/api/ventes" && req.method === "GET") {
    return "CONSULTATION_VENTES";
  }

  if (route === "/api/mouvements-stock") {
    return "CONSULTATION_STOCK";
  }

  return req.method + "_" + route.replace(/^\/api\//, "").replace(/\//g, "_");
}

// ======================================================
// AUDIT — DÉTAILS SÉCURISÉS
// ======================================================

function construireDetailsAudit(req) {
  const body = req.body || {};
  const route = req.originalUrl.split("?")[0];

  const details = {};

  // ----------------------------------------------------
  // UTILISATEURS
  // ----------------------------------------------------

  if (route.includes("/api/utilisateurs")) {
    if (req.params.id) {
      details.utilisateur_id = Number(req.params.id);
    }

    if (body.nom) {
      details.nom = String(body.nom);
    }

    if (body.email) {
      details.email = String(body.email);
    }

    if (body.role) {
      details.role = String(body.role);
    }

    // IMPORTANT :
    // aucun mot de passe n'est enregistré.
  }

  // ----------------------------------------------------
  // CLIENTS
  // ----------------------------------------------------

  if (route.includes("/api/clients")) {
    if (req.params.id) {
      details.client_id = Number(req.params.id);
    }

    if (body.nom_complet) {
      details.nom_complet = String(body.nom_complet);
    }

    if (body.telephone) {
      details.telephone = String(body.telephone);
    }

    if (body.email) {
      details.email = String(body.email);
    }

    if (body.ville) {
      details.ville = String(body.ville);
    }
  }

  // ----------------------------------------------------
  // PRODUITS
  // ----------------------------------------------------

  if (route.includes("/api/produits")) {
    if (req.params.id) {
      details.produit_id = Number(req.params.id);
    }

    if (body.nom) {
      details.nom = String(body.nom);
    }

    if (body.prix !== undefined) {
      details.prix = Number(body.prix);
    }

    if (body.stock !== undefined) {
      details.stock = Number(body.stock);
    }

    if (body.description) {
      details.description = String(body.description);
    }
  }

  // ----------------------------------------------------
  // GESTION DU STOCK
  // ----------------------------------------------------

  if (route.includes("/api/produits") && route.endsWith("/stock")) {
    details.produit_id = Number(req.params.id);

    if (body.quantite !== undefined) {
      details.variation_stock = Number(body.quantite);
    }

    if (body.motif) {
      details.motif = String(body.motif);
    }
  }

  // ----------------------------------------------------
  // VENTES
  // ----------------------------------------------------

  if (route === "/api/ventes") {
    if (body.client_id !== undefined) {
      details.client_id = Number(body.client_id);
    }

    if (Array.isArray(body.produits)) {
      details.nombre_lignes = body.produits.length;

      details.produits = body.produits.map((ligne) => ({
        produit_id: Number(ligne.produit_id),
        quantite: Number(ligne.quantite),
      }));
    }
  }

  return details;
}

// ======================================================
// AUDIT — ENREGISTREMENT
// ======================================================

function enregistrerAudit(req, res) {
  const route = req.originalUrl.split("?")[0];

  // On ne journalise pas les routes techniques
  // ni la consultation de l'audit lui-même.
  if (
    !route.startsWith("/api/") ||
    route === "/api/test-db" ||
    route === "/api/session" ||
    route === "/api/audit"
  ) {
    return;
  }

  const utilisateur = req.session && req.session.user ? req.session.user : null;

  const details = construireDetailsAudit(req);

  details.utilisateur_email = utilisateur ? utilisateur.email : null;

  details.utilisateur_role = utilisateur ? utilisateur.role : null;

  pool
    .query(
      `
        INSERT INTO audit_logs
        (
          utilisateur_id,
          action,
          methode,
          route,
          statut_http,
          details,
          adresse_ip,
          user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        utilisateur ? utilisateur.id : null,
        determinerAction(req),
        req.method,
        route,
        res.statusCode,
        JSON.stringify(details),
        req.ip || null,
        req.get("user-agent") || null,
      ],
    )
    .catch((error) => {
      console.error("Erreur enregistrement audit :", error);
    });
}

// ======================================================
// MIDDLEWARE AUDIT
// ======================================================

app.use((req, res, next) => {
  res.on("finish", () => {
    enregistrerAudit(req, res);
  });

  next();
});

// ======================================================
// ROUTES TECHNIQUES
// ======================================================

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS heure");

    res.json({
      message: "Connexion PostgreSQL réussie",
      heure: result.rows[0].heure,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Erreur de connexion à PostgreSQL",
    });
  }
});

// ======================================================
// CONNEXION
// ======================================================

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.mot_de_passe || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "L'email et le mot de passe sont obligatoires.",
      });
    }

    const result = await pool.query(
      `
        SELECT
          id,
          nom,
          email,
          mot_de_passe,
          role
        FROM utilisateurs
        WHERE email = $1
      `,
      [email],
    );

    if (!result.rows.length) {
      return res.status(401).json({
        message: "Email ou mot de passe incorrect.",
      });
    }

    const utilisateur = result.rows[0];

    const passwordCorrect = await bcrypt.compare(
      password,
      utilisateur.mot_de_passe,
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        message: "Email ou mot de passe incorrect.",
      });
    }

    req.session.user = {
      id: utilisateur.id,
      nom: utilisateur.nom,
      email: utilisateur.email,
      role: utilisateur.role,
    };

    res.json({
      message: "Connexion réussie.",
      utilisateur: req.session.user,
    });
  } catch (error) {
    console.error("Erreur connexion :", error);

    res.status(500).json({
      message: "Impossible de se connecter.",
    });
  }
});

// ======================================================
// SESSION
// ======================================================

app.get("/api/session", (req, res) => {
  if (!req.session.user) {
    return res.json({
      connecte: false,
    });
  }

  res.json({
    connecte: true,
    utilisateur: req.session.user,
  });
});

// ======================================================
// DÉCONNEXION
// ======================================================

app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error(error);

      return res.status(500).json({
        message: "Impossible de se déconnecter.",
      });
    }

    res.clearCookie("connect.sid");

    res.json({
      message: "Déconnexion réussie.",
    });
  });
});

// ======================================================
// MOT DE PASSE OUBLIÉ
// ======================================================

app.post("/api/forgot-password", async (req, res) => {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();

  const generic = {
    message:
      "Si cette adresse existe, un lien de réinitialisation vient d'être envoyé.",
  };

  if (!email) {
    return res.status(400).json({
      message: "Veuillez saisir votre adresse e-mail.",
    });
  }

  try {
    const result = await pool.query(
      `
          SELECT id, nom, email
          FROM utilisateurs
          WHERE email = $1
        `,
      [email],
    );

    if (!result.rows.length) {
      return res.json(generic);
    }

    const utilisateur = result.rows[0];

    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await pool.query(
      `
          UPDATE password_reset_tokens
          SET utilise = TRUE
          WHERE utilisateur_id = $1
          AND utilise = FALSE
        `,
      [utilisateur.id],
    );

    await pool.query(
      `
          INSERT INTO password_reset_tokens
          (
            utilisateur_id,
            token_hash,
            expire_at
          )
          VALUES
          (
            $1,
            $2,
            NOW() + INTERVAL '15 minutes'
          )
        `,
      [utilisateur.id, tokenHash],
    );

    const baseUrl = (
      process.env.APP_URL || `${req.protocol}://${req.get("host")}`
    ).replace(/\/$/, "");

    const resetUrl = `${baseUrl}/reset-password.html?token=${token}`;

    const mailer = getMailer();

    if (!mailer) {
      console.warn(
        "SMTP non configuré. Lien de réinitialisation non envoyé.",
        resetUrl,
      );

      return res.json(generic);
    }

    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,

      to: utilisateur.email,

      subject: "MYSALES — Réinitialisation de votre mot de passe",

      text:
        `Bonjour ${utilisateur.nom},\n\n` +
        `Utilisez ce lien pour définir un nouveau mot de passe :\n` +
        `${resetUrl}\n\n` +
        `Ce lien expire dans 15 minutes et ne peut être utilisé qu'une seule fois.\n\n` +
        `Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    });

    res.json(generic);
  } catch (error) {
    console.error("Erreur mot de passe oublié :", error);

    res.status(500).json({
      message: "Impossible de traiter la demande pour le moment.",
    });
  }
});

// ======================================================
// RÉINITIALISATION MOT DE PASSE
// ======================================================

app.post("/api/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token || "");

    const password = String(req.body.mot_de_passe || "");

    if (!token || password.length < 8) {
      return res.status(400).json({
        message:
          "Le lien et un mot de passe d'au moins 8 caractères sont obligatoires.",
      });
    }

    const hash = crypto.createHash("sha256").update(token).digest("hex");

    const result = await pool.query(
      `
          SELECT id, utilisateur_id
          FROM password_reset_tokens
          WHERE token_hash = $1
          AND utilise = FALSE
          AND expire_at > NOW()
        `,
      [hash],
    );

    if (!result.rows.length) {
      return res.status(400).json({
        message: "Ce lien est invalide, expiré ou déjà utilisé.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `
          UPDATE utilisateurs
          SET mot_de_passe = $1
          WHERE id = $2
        `,
      [passwordHash, result.rows[0].utilisateur_id],
    );

    await pool.query(
      `
          UPDATE password_reset_tokens
          SET utilise = TRUE
          WHERE id = $1
        `,
      [result.rows[0].id],
    );

    res.json({
      message:
        "Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter.",
    });
  } catch (error) {
    console.error("Erreur reset password :", error);

    res.status(500).json({
      message: "Impossible de réinitialiser le mot de passe.",
    });
  }
});

// ======================================================
// PAGES
// ======================================================

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.sendFile(path.join(FRONTEND, "index.html"));
  }

  res.redirect("/login.html");
});

for (const page of [
  "index.html",
  "clients.html",
  "produits.html",
  "ventes.html",
  "dashboard.html",
]) {
  app.get(`/${page}`, requirePageAuth, (req, res) => {
    res.sendFile(path.join(FRONTEND, page));
  });
}

app.get("/stock.html", requireAdminPage, (req, res) => {
  res.sendFile(path.join(FRONTEND, "stock.html"));
});

app.get("/utilisateurs.html", requireAdminPage, (req, res) => {
  res.sendFile(path.join(FRONTEND, "utilisateurs.html"));
});

app.get("/audit.html", requireAdminPage, (req, res) => {
  res.sendFile(path.join(FRONTEND, "audit.html"));
});

app.use(express.static(FRONTEND));

// ======================================================
// UTILISATEURS
// ======================================================

app.get("/api/utilisateurs", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
          SELECT
            id,
            nom,
            email,
            role,
            date_creation
          FROM utilisateurs
          ORDER BY id DESC
        `,
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Impossible de récupérer les utilisateurs.",
    });
  }
});

app.post("/api/utilisateurs", requireAdmin, async (req, res) => {
  try {
    const { nom, email, mot_de_passe, role } = req.body;

    if (!nom || !email || !mot_de_passe || !role) {
      return res.status(400).json({
        message:
          "Le nom, l'email, le mot de passe et le rôle sont obligatoires.",
      });
    }

    if (!["admin", "vendeur"].includes(role)) {
      return res.status(400).json({
        message: "Rôle invalide.",
      });
    }

    if (mot_de_passe.length < 8) {
      return res.status(400).json({
        message: "Le mot de passe doit contenir au moins 8 caractères.",
      });
    }

    const hash = await bcrypt.hash(mot_de_passe, 12);

    const result = await pool.query(
      `
            INSERT INTO utilisateurs
            (
              nom,
              email,
              mot_de_passe,
              role
            )
            VALUES
            ($1, $2, $3, $4)
            RETURNING
              id,
              nom,
              email,
              role,
              date_creation
          `,
      [nom.trim(), email.trim().toLowerCase(), hash, role],
    );

    res.status(201).json({
      message: "Utilisateur créé avec succès.",
      utilisateur: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Cette adresse e-mail existe déjà.",
      });
    }

    console.error(error);

    res.status(500).json({
      message: "Impossible de créer l'utilisateur.",
    });
  }
});

app.put("/api/utilisateurs/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const { nom, email, mot_de_passe, role } = req.body;

    if (
      !Number.isInteger(id) ||
      !nom ||
      !email ||
      !["admin", "vendeur"].includes(role)
    ) {
      return res.status(400).json({
        message: "Données utilisateur invalides.",
      });
    }

    let result;

    if (mot_de_passe?.trim()) {
      if (mot_de_passe.length < 8) {
        return res.status(400).json({
          message: "Le mot de passe doit contenir au moins 8 caractères.",
        });
      }

      const hash = await bcrypt.hash(mot_de_passe, 12);

      result = await pool.query(
        `
            UPDATE utilisateurs
            SET
              nom = $1,
              email = $2,
              mot_de_passe = $3,
              role = $4
            WHERE id = $5
            RETURNING
              id,
              nom,
              email,
              role,
              date_creation
          `,
        [nom.trim(), email.trim().toLowerCase(), hash, role, id],
      );
    } else {
      result = await pool.query(
        `
            UPDATE utilisateurs
            SET
              nom = $1,
              email = $2,
              role = $3
            WHERE id = $4
            RETURNING
              id,
              nom,
              email,
              role,
              date_creation
          `,
        [nom.trim(), email.trim().toLowerCase(), role, id],
      );
    }

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Utilisateur introuvable.",
      });
    }

    if (req.session.user.id === id) {
      req.session.user = {
        ...req.session.user,
        ...result.rows[0],
      };
    }

    res.json({
      message: "Utilisateur modifié avec succès.",
      utilisateur: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Cette adresse e-mail existe déjà.",
      });
    }

    console.error(error);

    res.status(500).json({
      message: "Impossible de modifier l'utilisateur.",
    });
  }
});

app.delete("/api/utilisateurs/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (req.session.user.id === id) {
      return res.status(400).json({
        message: "Vous ne pouvez pas supprimer votre propre compte.",
      });
    }

    const result = await pool.query(
      `
            DELETE FROM utilisateurs
            WHERE id = $1
            RETURNING
              id,
              nom,
              email,
              role
          `,
      [id],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Utilisateur introuvable.",
      });
    }

    res.json({
      message: "Utilisateur supprimé avec succès.",
      utilisateur: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Impossible de supprimer l'utilisateur.",
    });
  }
});

// ======================================================
// CLIENTS
// ======================================================

app.get("/api/clients", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT
              id,
              nom_complet,
              telephone,
              email,
              ville,
              date_creation
            FROM clients
            ORDER BY id DESC
          `,
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Impossible de récupérer les clients.",
    });
  }
});

app.post("/api/clients", requireAuth, async (req, res) => {
  try {
    const { nom_complet, telephone, email, ville } = req.body;

    if (!nom_complet || !telephone) {
      return res.status(400).json({
        message: "Le nom complet et le téléphone sont obligatoires.",
      });
    }

    const result = await pool.query(
      `
            INSERT INTO clients
            (
              nom_complet,
              telephone,
              email,
              ville
            )
            VALUES
            ($1, $2, $3, $4)
            RETURNING
              id,
              nom_complet,
              telephone,
              email,
              ville,
              date_creation
          `,
      [
        nom_complet.trim(),
        telephone.trim(),
        email?.trim() || null,
        ville?.trim() || null,
      ],
    );

    res.status(201).json({
      message: "Client ajouté avec succès.",
      client: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Ce numéro de téléphone existe déjà.",
      });
    }

    console.error(error);

    res.status(500).json({
      message: "Impossible d'ajouter le client.",
    });
  }
});

app.put("/api/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const { nom_complet, telephone, email, ville } = req.body;

    if (!Number.isInteger(id) || !nom_complet || !telephone) {
      return res.status(400).json({
        message: "Données client invalides.",
      });
    }

    const result = await pool.query(
      `
            UPDATE clients
            SET
              nom_complet = $1,
              telephone = $2,
              email = $3,
              ville = $4
            WHERE id = $5
            RETURNING
              id,
              nom_complet,
              telephone,
              email,
              ville,
              date_creation
          `,
      [
        nom_complet.trim(),
        telephone.trim(),
        email?.trim() || null,
        ville?.trim() || null,
        id,
      ],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Client introuvable.",
      });
    }

    res.json({
      message: "Client modifié avec succès.",
      client: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Ce numéro de téléphone existe déjà.",
      });
    }

    console.error(error);

    res.status(500).json({
      message: "Impossible de modifier le client.",
    });
  }
});

app.delete("/api/clients/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      `
            DELETE FROM clients
            WHERE id = $1
            RETURNING id, nom_complet
          `,
      [id],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Client introuvable.",
      });
    }

    res.json({
      message: "Client supprimé avec succès.",
      client: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        message:
          "Impossible de supprimer ce client car il possède déjà une vente.",
      });
    }

    console.error(error);

    res.status(500).json({
      message: "Impossible de supprimer le client.",
    });
  }
});

// ======================================================
// PRODUITS
// ======================================================

app.get("/api/produits", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT
              id,
              nom,
              description,
              prix,
              stock,
              date_creation
            FROM produits
            ORDER BY id DESC
          `,
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Impossible de récupérer les produits.",
    });
  }
});

app.post("/api/produits", requireAdmin, async (req, res) => {
  try {
    const { nom, description, prix, stock } = req.body;

    const prixNombre = Number(prix);
    const stockNombre = Number(stock);

    if (
      !nom ||
      !Number.isFinite(prixNombre) ||
      prixNombre < 0 ||
      !Number.isInteger(stockNombre) ||
      stockNombre < 0
    ) {
      return res.status(400).json({
        message: "Nom, prix et stock valides obligatoires.",
      });
    }

    const result = await pool.query(
      `
            INSERT INTO produits
            (
              nom,
              description,
              prix,
              stock
            )
            VALUES
            ($1, $2, $3, $4)
            RETURNING
              id,
              nom,
              description,
              prix,
              stock,
              date_creation
          `,
      [nom.trim(), description?.trim() || null, prixNombre, stockNombre],
    );

    const produit = result.rows[0];

    if (stockNombre > 0) {
      await pool.query(
        `
            INSERT INTO mouvements_stock
            (
              produit_id,
              utilisateur_id,
              type_mouvement,
              quantite,
              stock_avant,
              stock_apres,
              motif
            )
            VALUES
            ($1, $2, 'entree', $3, 0, $3, $4)
          `,
        [produit.id, req.session.user.id, stockNombre, "Stock initial"],
      );
    }

    res.status(201).json({
      message: "Produit ajouté avec succès.",
      produit,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Impossible d'ajouter le produit.",
    });
  }
});

app.put("/api/produits/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const { nom, description, prix, stock } = req.body;

    const prixNombre = Number(prix);
    const stockNombre = Number(stock);

    if (
      !Number.isInteger(id) ||
      !nom ||
      !Number.isFinite(prixNombre) ||
      prixNombre < 0 ||
      !Number.isInteger(stockNombre) ||
      stockNombre < 0
    ) {
      return res.status(400).json({
        message: "Données produit invalides.",
      });
    }

    const ancien = await pool.query(
      `
            SELECT id, stock
            FROM produits
            WHERE id = $1
          `,
      [id],
    );

    if (!ancien.rows.length) {
      return res.status(404).json({
        message: "Produit introuvable.",
      });
    }

    const stockAvant = ancien.rows[0].stock;

    const result = await pool.query(
      `
            UPDATE produits
            SET
              nom = $1,
              description = $2,
              prix = $3,
              stock = $4
            WHERE id = $5
            RETURNING
              id,
              nom,
              description,
              prix,
              stock,
              date_creation
          `,
      [nom.trim(), description?.trim() || null, prixNombre, stockNombre, id],
    );

    if (stockNombre !== stockAvant) {
      await pool.query(
        `
            INSERT INTO mouvements_stock
            (
              produit_id,
              utilisateur_id,
              type_mouvement,
              quantite,
              stock_avant,
              stock_apres,
              motif
            )
            VALUES
            (
              $1,
              $2,
              'ajustement',
              $3,
              $4,
              $5,
              $6
            )
          `,
        [
          id,
          req.session.user.id,
          stockNombre - stockAvant,
          stockAvant,
          stockNombre,
          "Modification administrative du stock",
        ],
      );
    }

    res.json({
      message: "Produit modifié avec succès.",
      produit: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Impossible de modifier le produit.",
    });
  }
});

app.delete("/api/produits/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      `
            DELETE FROM produits
            WHERE id = $1
            RETURNING id, nom
          `,
      [id],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Produit introuvable.",
      });
    }

    res.json({
      message: "Produit supprimé avec succès.",
      produit: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        message:
          "Impossible de supprimer ce produit car il est déjà utilisé dans une vente.",
      });
    }

    console.error(error);

    res.status(500).json({
      message: "Impossible de supprimer le produit.",
    });
  }
});

// ======================================================
// GESTION DU STOCK
// ======================================================

app.post("/api/produits/:id/stock", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const variation = Number(req.body.quantite);

    const motif = String(req.body.motif || "").trim();

    const type = variation >= 0 ? "entree" : "sortie";

    if (
      !Number.isInteger(id) ||
      !Number.isInteger(variation) ||
      variation === 0
    ) {
      return res.status(400).json({
        message: "La variation doit être un entier différent de 0.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
              SELECT
                id,
                nom,
                stock
              FROM produits
              WHERE id = $1
              FOR UPDATE
            `,
        [id],
      );

      if (!result.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Produit introuvable.",
        });
      }

      const stockAvant = result.rows[0].stock;

      const stockApres = stockAvant + variation;

      if (stockApres < 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: `Stock insuffisant. Stock actuel : ${stockAvant}.`,
        });
      }

      await client.query(
        `
            UPDATE produits
            SET stock = $1
            WHERE id = $2
          `,
        [stockApres, id],
      );

      await client.query(
        `
            INSERT INTO mouvements_stock
            (
              produit_id,
              utilisateur_id,
              type_mouvement,
              quantite,
              stock_avant,
              stock_apres,
              motif
            )
            VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7
            )
          `,
        [
          id,
          req.session.user.id,
          type,
          Math.abs(variation),
          stockAvant,
          stockApres,
          motif || "Ajustement administratif",
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Stock mis à jour.",
        produit: {
          ...result.rows[0],
          stock: stockApres,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Impossible de modifier le stock.",
    });
  }
});

// ======================================================
// HISTORIQUE DU STOCK
// ======================================================

app.get("/api/mouvements-stock", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT
              m.id,
              m.date_mouvement,
              m.type_mouvement,
              m.quantite,
              m.stock_avant,
              m.stock_apres,
              m.motif,
              p.nom AS produit,
              u.nom AS utilisateur
            FROM mouvements_stock m
            JOIN produits p
              ON p.id = m.produit_id
            JOIN utilisateurs u
              ON u.id = m.utilisateur_id
            ORDER BY m.id DESC
            LIMIT 200
          `,
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Impossible de récupérer l'historique du stock.",
    });
  }
});

// ======================================================
// AUDIT — CONSULTATION
// ======================================================

app.get("/api/audit", requireAdmin, async (req, res) => {
  try {
    const limite = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);

    const result = await pool.query(
      `
            SELECT
              a.id,
              a.date_action,
              a.action,
              a.methode,
              a.route,
              a.statut_http,
              a.details,
              a.adresse_ip,
              a.user_agent,
              u.nom AS utilisateur,
              u.email
            FROM audit_logs a
            LEFT JOIN utilisateurs u
              ON u.id = a.utilisateur_id
            ORDER BY a.id DESC
            LIMIT $1
          `,
      [limite],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erreur récupération audit :", error);

    res.status(500).json({
      message: "Impossible de récupérer l'audit.",
    });
  }
});

// ======================================================
// VENTES
// ======================================================

app.get("/api/ventes", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT
              v.id,
              v.date_vente,
              v.total,
              c.nom_complet AS client,
              u.nom AS vendeur,

              COALESCE(
                json_agg(
                  json_build_object(
                    'produit_id',
                    p.id,
                    'produit',
                    p.nom,
                    'quantite',
                    dv.quantite,
                    'prix_unitaire',
                    dv.prix_unitaire,
                    'sous_total',
                    dv.quantite * dv.prix_unitaire
                  )
                  ORDER BY dv.id
                )
                FILTER (
                  WHERE dv.id IS NOT NULL
                ),
                '[]'::json
              ) AS produits

            FROM ventes v

            JOIN clients c
              ON c.id = v.client_id

            JOIN utilisateurs u
              ON u.id = v.utilisateur_id

            LEFT JOIN details_vente dv
              ON dv.vente_id = v.id

            LEFT JOIN produits p
              ON p.id = dv.produit_id

            GROUP BY
              v.id,
              c.nom_complet,
              u.nom

            ORDER BY v.id DESC
          `,
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Impossible de récupérer les ventes.",
    });
  }
});

app.post("/api/ventes", requireAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const clientId = Number(req.body.client_id);

    const produits = req.body.produits;

    if (
      !Number.isInteger(clientId) ||
      !Array.isArray(produits) ||
      !produits.length
    ) {
      return res.status(400).json({
        message: "Client et panier valides obligatoires.",
      });
    }

    const map = new Map();

    for (const ligne of produits) {
      const produitId = Number(ligne.produit_id);

      const quantite = Number(ligne.quantite);

      if (
        !Number.isInteger(produitId) ||
        produitId <= 0 ||
        !Number.isInteger(quantite) ||
        quantite <= 0
      ) {
        return res.status(400).json({
          message: "Produit ou quantité invalide.",
        });
      }

      map.set(produitId, (map.get(produitId) || 0) + quantite);
    }

    const lignes = [...map].map(([produit_id, quantite]) => ({
      produit_id,
      quantite,
    }));

    await client.query("BEGIN");

    const clientResult = await client.query(
      `
            SELECT
              id,
              nom_complet
            FROM clients
            WHERE id = $1
          `,
      [clientId],
    );

    if (!clientResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Client introuvable.",
      });
    }

    const ids = lignes.map((ligne) => ligne.produit_id);

    const produitsResult = await client.query(
      `
            SELECT
              id,
              nom,
              prix,
              stock
            FROM produits
            WHERE id = ANY($1::int[])
            ORDER BY id
            FOR UPDATE
          `,
      [ids],
    );

    if (produitsResult.rows.length !== ids.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Un produit est introuvable.",
      });
    }

    const produitsMap = new Map(
      produitsResult.rows.map((produit) => [produit.id, produit]),
    );

    let total = 0;

    for (const ligne of lignes) {
      const produit = produitsMap.get(ligne.produit_id);

      if (Number(produit.stock) < ligne.quantite) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: `Stock insuffisant pour ${produit.nom}. Stock disponible : ${produit.stock}.`,
        });
      }

      total += Number(produit.prix) * ligne.quantite;
    }

    const venteResult = await client.query(
      `
            INSERT INTO ventes
            (
              client_id,
              total,
              utilisateur_id
            )
            VALUES
            ($1, $2, $3)
            RETURNING
              id,
              date_vente,
              total
          `,
      [clientId, total, req.session.user.id],
    );

    const vente = venteResult.rows[0];

    const produitsEnregistres = [];

    for (const ligne of lignes) {
      const produit = produitsMap.get(ligne.produit_id);

      const sousTotal = Number(produit.prix) * ligne.quantite;

      await client.query(
        `
            INSERT INTO details_vente
            (
              vente_id,
              produit_id,
              quantite,
              prix_unitaire
            )
            VALUES
            ($1, $2, $3, $4)
          `,
        [vente.id, ligne.produit_id, ligne.quantite, produit.prix],
      );

      const stockResult = await client.query(
        `
              UPDATE produits
              SET stock = stock - $1
              WHERE id = $2
              RETURNING stock
            `,
        [ligne.quantite, ligne.produit_id],
      );

      const stockApres = stockResult.rows[0].stock;

      await client.query(
        `
            INSERT INTO mouvements_stock
            (
              produit_id,
              utilisateur_id,
              type_mouvement,
              quantite,
              stock_avant,
              stock_apres,
              motif
            )
            VALUES
            (
              $1,
              $2,
              'vente',
              $3,
              $4,
              $5,
              $6
            )
          `,
        [
          ligne.produit_id,
          req.session.user.id,
          ligne.quantite,
          produit.stock,
          stockApres,
          `Vente #${vente.id}`,
        ],
      );

      produitsEnregistres.push({
        produit_id: produit.id,

        produit: produit.nom,

        quantite: ligne.quantite,

        prix_unitaire: Number(produit.prix),

        sous_total: sousTotal,

        stock_restant: stockApres,
      });
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Commande enregistrée avec succès.",

      vente: {
        id: vente.id,

        client: clientResult.rows[0].nom_complet,

        produits: produitsEnregistres,

        total,

        date_vente: vente.date_vente,

        vendeur: req.session.user.nom,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(error);

    res.status(500).json({
      message: "Impossible d'enregistrer la commande.",
    });
  } finally {
    client.release();
  }
});

// ======================================================
// ROUTE 404
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    message: "Route introuvable",
    methode: req.method,
    route: req.originalUrl,
  });
});

// ======================================================
// DÉMARRAGE
// ======================================================

async function start() {
  try {
    await initDatabase();

    console.log("Base MYSALES initialisée.");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Serveur MYSALES démarré sur le port ${PORT}`);
    });
  } catch (error) {
    console.error("Impossible d'initialiser la base MYSALES :", error);

    process.exit(1);
  }
}

start();
