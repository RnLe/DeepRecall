#!/bin/bash
# Reset the SQLite database
# This will delete the database file and it will be recreated on next startup

DB_PATH="./data/cas.db"

if [ -f "$DB_PATH" ]; then
    echo "Deleting database at $DB_PATH..."
    rm "$DB_PATH"
    echo "Database deleted. It will be recreated on next scan/startup."
else
    echo "Database not found at $DB_PATH (already deleted or doesn't exist yet)."
fi

# Also delete WAL and SHM files if they exist
if [ -f "$DB_PATH-wal" ]; then
    rm "$DB_PATH-wal"
    echo "Deleted WAL file"
fi

if [ -f "$DB_PATH-shm" ]; then
    rm "$DB_PATH-shm"
    echo "Deleted SHM file"
fi

echo "Database reset complete!"
