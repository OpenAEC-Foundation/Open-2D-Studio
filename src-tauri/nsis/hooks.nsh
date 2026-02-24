; Open 2D Studio - NSIS Installer Hooks
; Applies custom document icons for .o2d and .dxf file associations.
; Provides a custom page with checkboxes so users can opt in/out.
;
; Note: Tauri's template already registers file associations via APP_ASSOCIATE
; (from fileAssociations in tauri.conf.json). Our hook only needs to overwrite
; the DefaultIcon to use our custom document icons instead of the app exe icon.
; We write to SHCTX\Software\Classes\ to match APP_ASSOCIATE's registry hive.
;
; The Page custom declaration is in the custom installer.nsi template
; (between Start Menu and InstFiles pages) so it appears in the correct position.

; nsDialogs for the checkbox page (system include, ships with NSIS)
!include "nsDialogs.nsh"

; ============================================================
; Variables for the file association page
; ============================================================
Var AssocDialog
Var AssocO2DCheckbox
Var AssocO2DState
Var AssocDXFCheckbox
Var AssocDXFState

; ============================================================
; Page creation function
; ============================================================
Function FileAssocPageCreate
  ; Skip in passive/silent mode
  ${If} $PassiveMode = 1
    ; Default to checked for passive installs
    StrCpy $AssocO2DState ${BST_CHECKED}
    StrCpy $AssocDXFState ${BST_CHECKED}
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "File Associations" "Choose which file types to associate with ${PRODUCTNAME}."

  nsDialogs::Create 1018
  Pop $AssocDialog
  ${If} $AssocDialog == error
    Abort
  ${EndIf}

  ; Description label
  ${NSD_CreateLabel} 0 0 100% 28u "Select which file types should be opened with ${PRODUCTNAME}:$\n(You can change these later in Windows Settings.)"
  Pop $0

  ; .o2d checkbox — checked by default
  ${NSD_CreateCheckBox} 12u 40u 100% 14u ".o2d  —  Open 2D Studio Project"
  Pop $AssocO2DCheckbox
  ${If} $AssocO2DState == ${BST_UNCHECKED}
    ${NSD_Uncheck} $AssocO2DCheckbox
  ${Else}
    ${NSD_Check} $AssocO2DCheckbox
  ${EndIf}

  ; .dxf checkbox — checked by default
  ${NSD_CreateCheckBox} 12u 60u 100% 14u ".dxf  —  DXF Drawing Exchange Format"
  Pop $AssocDXFCheckbox
  ${If} $AssocDXFState == ${BST_UNCHECKED}
    ${NSD_Uncheck} $AssocDXFCheckbox
  ${Else}
    ${NSD_Check} $AssocDXFCheckbox
  ${EndIf}

  nsDialogs::Show
FunctionEnd

; ============================================================
; Page leave function — save checkbox states
; ============================================================
Function FileAssocPageLeave
  ${NSD_GetState} $AssocO2DCheckbox $AssocO2DState
  ${NSD_GetState} $AssocDXFCheckbox $AssocDXFState
FunctionEnd

; ============================================================
; POST-INSTALL: Apply custom document icons to file associations
; ============================================================
; Tauri's APP_ASSOCIATE (from fileAssociations config) already created:
;   SHCTX\Software\Classes\.o2d  -> "o2d"
;   SHCTX\Software\Classes\o2d\DefaultIcon -> "$INSTDIR\exe,0"
; We just overwrite DefaultIcon to use our custom document .ico files.
; ============================================================
!macro NSIS_HOOK_POSTINSTALL

  ; --- .o2d custom document icon ---
  ${If} $AssocO2DState == ${BST_CHECKED}
    WriteRegStr SHCTX "Software\Classes\o2d\DefaultIcon" "" "$INSTDIR\icons\o2d-document.ico,0"
  ${EndIf}

  ; --- .dxf custom document icon ---
  ${If} $AssocDXFState == ${BST_CHECKED}
    WriteRegStr SHCTX "Software\Classes\dxf\DefaultIcon" "" "$INSTDIR\icons\dxf-document.ico,0"
  ${EndIf}

  ; Notify Windows Shell to refresh icons
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x0000, p 0, p 0)'

!macroend

; ============================================================
; PRE-UNINSTALL: Notify shell to refresh (cleanup handled by template)
; ============================================================
; Tauri's template already runs APP_UNASSOCIATE which removes the ProgIds
; and file extension keys. We just need to refresh the shell icons.
; ============================================================
!macro NSIS_HOOK_PREUNINSTALL

  ; Notify Windows Shell to refresh icons after associations are removed
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x0000, p 0, p 0)'

!macroend
