# Migrations

`../schema.sql` is the initial idempotent schema. Record future changes as numbered SQL files, apply each once in order and back up production data first. Never rerun development resets against production.
