# Impertio PDF Viewer

A modern cross-platform PDF viewer built with Avalonia UI and PDFium, featuring clean architecture and a ribbon-style interface.

## Project Overview

This is a C# .NET application designed for cross-platform use (Windows, macOS, Linux) with a focus on:
- **Clean Architecture**: Separated into Core, Desktop, and Rendering layers
- **Modern UI**: Avalonia UI with Foxit/PDF-XChange style ribbon interface
- **PDF Rendering**: Using PDFium for high-quality rendering
- **Cross-Platform**: Runs on Windows, macOS, and Linux

## Project Structure

```
impertio-pdf-editor/
├── src/
│   ├── PdfViewer.Core/         # Core business logic and interfaces
│   ├── PdfViewer.Desktop/      # Avalonia UI layer
│   └── PdfViewer.Rendering/    # PDF rendering implementation
├── tests/                      # Unit tests
├── docs/                       # Project documentation
└── PdfViewer.sln              # Visual Studio solution
```

## Technologies

- **.NET 10.0** - Framework
- **Avalonia UI** - Cross-platform UI framework
- **PDFium** - PDF rendering engine
- **CommunityToolkit.Mvvm** - MVVM framework

## Getting Started

### Prerequisites

- .NET 10.0 SDK
- Visual Studio 2022 / VS Code / JetBrains Rider

### Build and Run

**Using CLI:**
```bash
cd impertio-pdf-editor
dotnet run --project src/PdfViewer.Desktop/PdfViewer.Desktop.csproj
```

**Using Visual Studio:**
1. Open `PdfViewer.sln` in Visual Studio
2. Set `PdfViewer.Desktop` as startup project
3. Press F5 to run

## Features

### Implemented
- PDF file opening and rendering
- Multiple view modes (Single Page, Continuous, Two-Page)
- Zoom controls (zoom in/out, fit width, fit page, presets)
- Page rotation (clockwise/counter-clockwise)
- Page navigation with keyboard shortcuts
- Thumbnail sidebar with auto-scroll
- Bookmarks/Outline panel
- Search functionality (Ctrl+F)
- Hand tool for panning
- Select text tool
- Drag and drop PDF files
- Recent files menu
- Document properties dialog
- Presentation mode (slideshow)
- Print support
- Save As functionality
- Full screen mode (F11)
- Keyboard navigation (Page Up/Down, Home, End, Arrow keys)
- Mouse wheel zoom (Ctrl+Scroll)

### Keyboard Shortcuts
- **Ctrl+O** - Open file
- **Ctrl+S** - Save
- **Ctrl+Shift+S** - Save As
- **Ctrl+P** - Print
- **Ctrl+F** - Find text
- **Ctrl+G** - Go to page
- **Ctrl++** - Zoom in
- **Ctrl+-** - Zoom out
- **F11** - Toggle full screen
- **Page Up/Down** - Navigate pages
- **Home/End** - First/Last page
- **Escape** - Close search/exit full screen

## Development Status

**Current Phase**: Phase 2 - Core Features (In Progress)

### Roadmap

#### Phase 1: Foundation (Completed)
- Project structure and architecture
- Basic PDF rendering with PDFium
- Core UI components

#### Phase 2: Core Features (In Progress)
- [x] PDF viewing with high-quality rendering
- [x] Multiple view modes (Single, Continuous, Two-Page)
- [x] Navigation, zoom, and rotation
- [x] Search and bookmarks
- [x] Print and save
- [x] Thumbnail sidebar
- [x] Keyboard shortcuts
- [x] Hand tool for panning
- [x] Drag and drop support
- [x] Recent files
- [x] Document properties
- [x] Presentation mode
- [ ] Text selection and copy
- [ ] Page extraction
- [ ] Page deletion/reordering
- [ ] Merge PDF files
- [ ] Split PDF files
- [ ] Export pages as images
- [ ] Night/Dark mode
- [ ] Customizable toolbar
- [ ] Tab support (multiple documents)

#### Phase 3: Performance Optimization (Planned)
- GPU-accelerated rendering
- Progressive page rendering
- Virtual scrolling for large documents
- Memory pooling and optimization
- Multi-threaded rendering
- Page caching improvements

#### Phase 4: Advanced Features (Planned)
- Text selection and copy
- Annotations (highlight, underline, notes)
- Form filling
- Digital signatures
- Document comparison
- OCR integration

#### Phase 5: Collaboration & Cloud (Planned)
- Cloud storage integration
- Document sharing
- Collaborative annotations
- Version history

## License

This project is open source software developed by **Impertio** and licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Impertio
