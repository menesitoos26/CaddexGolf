-- Añade la dispersión de calle a la tarjeta.
--
-- Hasta ahora sólo se guardaba si la salida iba a calle o no (fairway_hit).
-- Con fairway_side se registra además hacia qué lado se falló, que es lo que
-- permite detectar un fallo sistemático (siempre a la izquierda, por ejemplo).
--
-- Uso:
--   docker exec -i caddex_db mysql -ugolf_user -pgolf_pass golf_db < 002_dispersion_de_calle.sql

SET NAMES utf8mb4;
START TRANSACTION;

ALTER TABLE round_holes
    ADD COLUMN fairway_side VARCHAR(10) DEFAULT NULL AFTER fairway_hit,
    ADD CONSTRAINT ck_hole_fairway_side CHECK (
        fairway_side IS NULL OR fairway_side IN ('izquierda', 'centro', 'derecha')
    );

-- Las calles ya acertadas equivalen a "centro". Los fallos anteriores se dejan
-- en NULL: no sabemos hacia dónde fueron y no queremos inventar el dato.
UPDATE round_holes SET fairway_side = 'centro' WHERE fairway_hit = 1;

COMMIT;
