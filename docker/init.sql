-- Esquema de Golf Tracker (MySQL 8)
-- Se ejecuta automáticamente la primera vez que arranca el contenedor de MySQL.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    handicap        DECIMAL(4,1) DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Directorio de clubes. No guarda el par: el par depende de los hoyos que se
-- jueguen en cada ronda, así que viaja dentro de la tarjeta (round_holes).
CREATE TABLE IF NOT EXISTS courses (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    external_id     VARCHAR(50) DEFAULT NULL,
    name            VARCHAR(255) NOT NULL,
    city            VARCHAR(100) DEFAULT NULL,
    country         VARCHAR(100) DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_courses_external_id (external_id),
    UNIQUE KEY uq_course_name_city (name, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tournaments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(150) NOT NULL,
    location        VARCHAR(150) DEFAULT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE DEFAULT NULL,
    final_position  INT DEFAULT NULL,
    notes           TEXT DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY ix_tournaments_user_id (user_id),
    CONSTRAINT fk_tournaments_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rounds (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    course_id       INT NOT NULL,
    tournament_id   INT DEFAULT NULL,
    played_on       DATE NOT NULL,
    holes_played    INT NOT NULL,
    total_par       INT NOT NULL,
    total_strokes   INT NOT NULL,
    total_putts     INT DEFAULT NULL,
    course_rating   DECIMAL(4,1) DEFAULT NULL,
    slope_rating    INT DEFAULT NULL,
    weather         VARCHAR(50) DEFAULT NULL,
    notes           TEXT DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY ix_rounds_user_id (user_id),
    KEY ix_rounds_course_id (course_id),
    KEY ix_rounds_tournament_id (tournament_id),
    KEY ix_rounds_played_on (played_on),
    KEY ix_rounds_user_played_on (user_id, played_on),
    CONSTRAINT ck_round_holes_played CHECK (holes_played > 0),
    CONSTRAINT fk_rounds_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_rounds_course FOREIGN KEY (course_id)
        REFERENCES courses(id),
    CONSTRAINT fk_rounds_tournament FOREIGN KEY (tournament_id)
        REFERENCES tournaments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- La tarjeta: un registro por hoyo jugado en esa ronda concreta.
CREATE TABLE IF NOT EXISTS round_holes (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    round_id            INT NOT NULL,
    hole_number         INT NOT NULL,
    par                 INT NOT NULL,
    strokes             INT NOT NULL,
    putts               INT DEFAULT NULL,
    fairway_hit         BOOLEAN DEFAULT NULL,
    fairway_side        VARCHAR(10) DEFAULT NULL,
    green_in_regulation BOOLEAN DEFAULT NULL,
    penalties           INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_round_hole (round_id, hole_number),
    KEY ix_round_holes_round_id (round_id),
    CONSTRAINT ck_hole_fairway_side CHECK (
        fairway_side IS NULL OR fairway_side IN ('izquierda', 'centro', 'derecha')
    ),
    CONSTRAINT ck_hole_par CHECK (par BETWEEN 3 AND 6),
    CONSTRAINT ck_hole_strokes CHECK (strokes BETWEEN 1 AND 20),
    CONSTRAINT ck_hole_number CHECK (hole_number BETWEEN 1 AND 18),
    CONSTRAINT fk_round_holes_round FOREIGN KEY (round_id)
        REFERENCES rounds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
