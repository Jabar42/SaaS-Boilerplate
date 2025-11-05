#!/bin/bash

# Script para configurar Storage usando el CLI de Supabase con contraseña
# Ejecutar: bash scripts/setup-storage-with-password.sh

DB_PASSWORD="Jalubami9820@"

echo "🔧 Configurando Storage en Supabase..."
echo ""

# Aplicar la migración usando la contraseña
echo "📦 Aplicando migración de Storage..."
echo "$DB_PASSWORD" | supabase db push --password "$DB_PASSWORD" 2>&1 || {
    echo ""
    echo "⚠️  Si el comando falla, puedes ejecutar el SQL manualmente:"
    echo ""
    echo "1. Ve a: https://app.supabase.com/project/vokmywtmmrmeryjukozr/sql/new"
    echo "2. Copia y pega el contenido de: scripts/setup-storage-direct.sql"
    echo "3. Haz clic en 'Run'"
    echo ""
}

