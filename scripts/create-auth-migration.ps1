# Script to create Prisma migration for authentication tables
# Run this before deploying to production

Write-Host "Creating Prisma migration for Better Auth tables..." -ForegroundColor Green

Set-Location apps\backend

# Generate Prisma client
Write-Host "Generating Prisma client..." -ForegroundColor Cyan
pnpm prisma generate

# Create migration (will be applied automatically in docker-compose)
Write-Host "Creating migration SQL..." -ForegroundColor Cyan  
pnpm prisma migrate dev --name add_better_auth_tables --create-only

Write-Host "`n✅ Migration created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review the migration in apps\backend\prisma\migrations\"
Write-Host "2. Commit the migration files to git"
Write-Host "3. Deploy with: docker compose -f docker-compose.production.yml up -d"
Write-Host "4. Migrations will be applied automatically on startup"
