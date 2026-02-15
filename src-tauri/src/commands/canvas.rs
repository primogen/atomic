//! Canvas position commands — delegates to AtomicCore

use atomic_core::AtomicCore;
use tauri::State;

#[tauri::command]
pub fn get_atom_positions(
    core: State<AtomicCore>,
) -> Result<Vec<atomic_core::AtomPosition>, String> {
    core.get_atom_positions().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_atom_positions(
    core: State<AtomicCore>,
    positions: Vec<atomic_core::AtomPosition>,
) -> Result<(), String> {
    core.save_atom_positions(&positions)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_atoms_with_embeddings(
    core: State<AtomicCore>,
) -> Result<Vec<atomic_core::AtomWithEmbedding>, String> {
    core.get_atoms_with_embeddings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_canvas_level(
    core: State<AtomicCore>,
    parent_id: Option<String>,
    children_hint: Option<Vec<String>>,
) -> Result<atomic_core::CanvasLevel, String> {
    core.get_canvas_level(parent_id.as_deref(), children_hint)
        .map_err(|e| e.to_string())
}
