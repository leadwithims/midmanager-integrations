#!/bin/bash

# reorganize.sh
set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting project reorganization...${NC}"

# Create backup
timestamp=$(date +%Y%m%d_%H%M%S)
backup_dir="../src_backup_${timestamp}"
echo -e "${YELLOW}Creating backup at ${backup_dir}${NC}"
cp -r ../src "$backup_dir"

# Create new directory structure
echo -e "${YELLOW}Creating new directory structure...${NC}"
mkdir -p ../src/modules/{github,jira,metrics}/{collectors,services,dto}
mkdir -p ../src/core/{config,interfaces,decorators,guards,constants}
mkdir -p ../src/shared/{utils,types,dto}

# Move files to new structure
echo -e "${YELLOW}Moving files to new locations...${NC}"

# Move GitHub related files
echo "Moving GitHub files..."
mv ../src/integrations/github/github.service.ts ../src/modules/github/services/
mv ../src/integrations/github/github.controller.ts ../src/modules/github/
mv ../src/integrations/github/github.module.ts ../src/modules/github/
mv ../src/integrations/github/dto/* ../src/modules/github/dto/
mv ../src/collectors/github/github-collector.service.ts ../src/modules/github/collectors/
mv ../src/collectors/github/dto/* ../src/modules/github/dto/

# Move Jira related files
echo "Moving Jira files..."
mv ../src/collectors/jira/services/base/base-jira.service.ts ../src/modules/jira/services/
mv ../src/collectors/jira/services/status-manager.service.ts ../src/modules/jira/services/
mv ../src/collectors/jira/services/status-time-collector.service.ts ../src/modules/jira/collectors/
mv ../src/collectors/jira/services/team-metrics-collector.service.ts ../src/modules/jira/collectors/
mv ../src/collectors/jira/jira-collector.service.ts ../src/modules/jira/collectors/
mv ../src/collectors/jira/dto/* ../src/modules/jira/dto/
mv ../src/collectors/jira/constants/* ../src/core/constants/
mv ../src/collectors/jira/interfaces/* ../src/core/interfaces/
mv ../src/collectors/jira/utils/* ../src/shared/utils/

# Move Metrics related files
echo "Moving Metrics files..."
mv ../src/metrics/metrics.controller.ts ../src/modules/metrics/
mv ../src/metrics/metrics.module.ts ../src/modules/metrics/
mv ../src/metrics/interfaces/* ../src/core/interfaces/

# Move Core files
echo "Moving Core files..."
mv ../src/config/* ../src/core/config/
mv ../src/common/decorators/* ../src/core/decorators/
mv ../src/common/guards/* ../src/core/guards/
mv ../src/shared/decorators/* ../src/core/decorators/

# Move Queue and Sync to Metrics module
echo "Moving Queue and Sync files..."
mv ../src/queue/processors/* ../src/modules/metrics/processors/
mv ../src/sync/processors/* ../src/modules/metrics/processors/
mv ../src/sync/services/* ../src/modules/metrics/services/
mv ../src/sync/dto/* ../src/modules/metrics/dto/

# Clean up empty directories
echo "Cleaning up empty directories..."
find ../src -type d -empty -delete

# Create new barrel files
echo -e "${YELLOW}Creating barrel files...${NC}"

# Function to create barrel file
create_barrel() {
    local dir=$1
    local file="${dir}/index.ts"
    echo "// Export all from ${dir##*/}" > "$file"
    for f in "$dir"/*.ts; do
        if [ -f "$f" ] && [ "$(basename "$f")" != "index.ts" ]; then
            echo "export * from './${basename "$f" .ts}';" >> "$file"
        fi
    done
}

# Create barrel files for main directories
for dir in ../src/modules/*/; do
    create_barrel "$dir"
done

for dir in ../src/core/*/; do
    create_barrel "$dir"
done

for dir in ../src/shared/*/; do
    create_barrel "$dir"
done

echo -e "${GREEN}Project reorganization complete!${NC}"
echo -e "${YELLOW}Note: You will need to update import paths in your files.${NC}"
echo -e "${YELLOW}A backup of your original src directory has been created at: ${backup_dir}${NC}"

# Create import path update guide
echo -e "${YELLOW}Creating import path update guide...${NC}"
cat > ../import-path-updates.md << EOL
# Import Path Updates Guide

After reorganization, you'll need to update your import paths. Here are the common patterns:

## Old vs New Paths

### GitHub Related
- Old: '@/integrations/github' → New: '@/modules/github'
- Old: '@/collectors/github' → New: '@/modules/github/collectors'

### Jira Related
- Old: '@/collectors/jira' → New: '@/modules/jira/collectors'
- Old: '@/collectors/jira/services' → New: '@/modules/jira/services'

### Metrics Related
- Old: '@/metrics' → New: '@/modules/metrics'
- Old: '@/queue' → New: '@/modules/metrics/processors'
- Old: '@/sync' → New: '@/modules/metrics/services'

### Core and Shared
- Old: '@/config' → New: '@/core/config'
- Old: '@/common' → New: '@/core'
- Old: '@/shared' → New: '@/shared'

## Next Steps

1. Search for all import statements in your project
2. Update them according to the new structure
3. Update your tsconfig.json paths if necessary
4. Update any module imports in your *.module.ts files
EOL

echo -e "${GREEN}Import path update guide created at: ../import-path-updates.md${NC}"