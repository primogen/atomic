//! Canvas position routes

use crate::error::ok_or_error;
use crate::state::AppState;
use actix_web::{web, HttpResponse};
use atomic_core::AtomPosition;
use serde::Deserialize;

pub async fn get_positions(state: web::Data<AppState>) -> HttpResponse {
    ok_or_error(state.core.get_atom_positions())
}

pub async fn save_positions(
    state: web::Data<AppState>,
    body: web::Json<Vec<AtomPosition>>,
) -> HttpResponse {
    let positions = body.into_inner();
    match state.core.save_atom_positions(&positions) {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({"status": "ok"})),
        Err(e) => crate::error::error_response(e),
    }
}

pub async fn get_atoms_with_embeddings(state: web::Data<AppState>) -> HttpResponse {
    ok_or_error(state.core.get_atoms_with_embeddings())
}

#[derive(Deserialize)]
pub struct CanvasLevelQuery {
    pub parent_id: Option<String>,
}

#[derive(Deserialize)]
pub struct CanvasLevelBody {
    pub children_hint: Option<Vec<String>>,
}

pub async fn get_canvas_level(
    state: web::Data<AppState>,
    query: web::Query<CanvasLevelQuery>,
    body: Option<web::Json<CanvasLevelBody>>,
) -> HttpResponse {
    let parent_id = query.parent_id.as_deref();
    let children_hint = body.and_then(|b| b.into_inner().children_hint);
    ok_or_error(state.core.get_canvas_level(parent_id, children_hint))
}
