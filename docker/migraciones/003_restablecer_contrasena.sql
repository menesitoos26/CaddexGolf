-- Migración 003: restablecimiento de contraseña.
--
-- Aplicar en una base de datos ya existente (haz copia antes):
--   docker exec -i caddex_db mysql -ugolf_user -p"$MYSQL_PASSWORD" golf_db \
--     < docker/migraciones/003_restablecer_contrasena.sql

-- Generacion de sesiones. Cada token JWT lleva dentro la version con la que se
-- emitio; si no coincide con esta, no vale. Cambiar la contrasena la sube en
-- uno y deja fuera todos los tokens anteriores.
--
-- Las cuentas existentes arrancan en 0, y los tokens ya emitidos (que no
-- llevan el campo) se interpretan como version 0: nadie se queda fuera al
-- desplegar esto.
ALTER TABLE users
    ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER handicap;

CREATE TABLE IF NOT EXISTS password_resets (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    token_hash      CHAR(64) NOT NULL,
    expira_en       DATETIME NOT NULL,
    usado_en        DATETIME DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_password_resets_token (token_hash),
    KEY ix_password_resets_user_id (user_id),
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
