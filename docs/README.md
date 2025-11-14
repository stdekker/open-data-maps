# Open Data Maps Documentation

Welcome to the Open Data Maps (ODM) documentation. This directory contains all documentation for the project.

## Table of Contents

### General Documentation

- **[Architecture](architecture.md)** - Application architecture and structure overviewrestructured

### Editor Documentation

The editor is a secure administrative tool for editing polling station (stembureau) geographic coordinates.

- **[Editor Overview](editor/README.md)** - Complete editor documentation
- **[Installation Guide](editor/installation.md)** - Detailed installation instructions
- **[Matching Guide](editor/matching-guide.md)** - How to use the location matching feature
- **[Editor Summary](editor/editor-summary.md)** - Implementation summary and features

## Quick Links

### For Users

- **Getting Started**: See [Main README](../README.md) for installation
- **Editor Access**: `/edit/` (requires authentication)
- **Editor Quick Start**: [docs/editor/quick-start.md](editor/quick-start.md)

### For Developers

- **Architecture Overview**: [architecture.md](architecture.md)
- **Configuration**: 
  - Production: `/web/config.prod.php`
  - Default: `/web/config.default.php`
  - Editor: `/config/edit-config.php`
- **Data Processing**: `/tools/` directory

### For Administrators
- **Editor Installation**: [editor/installation.md](editor/installation.md)
- **Password Management**: Run `php tools/generate-edit-password.php`

## Documentation Structure

```
docs/
├── README.md                    # This file - documentation index
├── architecture.md              # Application architecture
└── editor/                      # Editor-specific documentation
    ├── README.md                # Editor main documentation
    ├── installation.md          # Installation guide
    ├── quick-start.md           # Quick start guide
    ├── matching-guide.md        # Location matching feature
    └── editor-summary.md        # Implementation summary
```

## Key Features Documented

### Main Application
- Map visualization (Mapbox GL)
- Municipality boundary visualization
- Demographic statistics
- Election data integration
- Interactive UI with search

### Editor Tool
- Secure authentication system
- Interactive map editor with draggable markers
- Batch editing and saving
- Automatic backup system
- Location matching between elections
- CSRF protection and access logging

## Getting Help

1. **Check the relevant documentation** in this directory
2. **Run verification scripts**: 
   - Editor: `php tools/verify-setup.php`
3. **Review logs**:
   - Editor access log: `logs/access.log`
   - PHP error logs (server-specific)
4. **Check browser console** for JavaScript errors

## Contributing

When adding new documentation:
1. Place general docs in `/docs/`
2. Place editor-specific docs in `/docs/editor/`
3. Update this README.md with links to new documentation
4. Use clear, descriptive filenames (lowercase with hyphens)

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](../LICENSE) file for details.

