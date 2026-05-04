"""Blueprint /api dla słowników (countries, location_types, relation_types) i osób."""

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from core import db_error_response, etag_json, execute, query, validation_error_response
from schemas import DictItem, PersonInput


bp = Blueprint('dicts', __name__)


def _register_dictionary_endpoints(table_name, url_path):
    """Generuje 4 endpointy CRUD dla prostego słownika (id, name)."""

    @bp.route(f'/api/{url_path}', endpoint=f'get_{url_path}')
    def list_items():
        rows = query(f"SELECT id, name FROM {table_name} ORDER BY name")
        return etag_json([dict(r) for r in rows])

    @bp.route(f'/api/{url_path}', methods=['POST'], endpoint=f'create_{url_path}')
    def create_item():
        try:
            d = DictItem.model_validate(request.json or {})
        except ValidationError as e:
            return validation_error_response(e)
        try:
            new_id = execute(f"INSERT INTO {table_name} (name) VALUES (%s) RETURNING id", (d.name,))
            return jsonify({'id': new_id, 'name': d.name}), 201
        except Exception as e:
            return db_error_response(e)

    @bp.route(f'/api/{url_path}/<int:item_id>', methods=['PUT'], endpoint=f'update_{url_path}')
    def update_item(item_id):
        try:
            d = DictItem.model_validate(request.json or {})
        except ValidationError as e:
            return validation_error_response(e)
        try:
            execute(f"UPDATE {table_name} SET name=%s WHERE id=%s", (d.name, item_id))
            return jsonify({'ok': True})
        except Exception as e:
            return db_error_response(e)

    @bp.route(f'/api/{url_path}/<int:item_id>', methods=['DELETE'], endpoint=f'delete_{url_path}')
    def delete_item(item_id):
        try:
            execute(f"DELETE FROM {table_name} WHERE id=%s", (item_id,))
            return jsonify({'ok': True})
        except Exception as e:
            return db_error_response(e)


_register_dictionary_endpoints('countries',      'countries')
_register_dictionary_endpoints('location_types', 'location_types')
_register_dictionary_endpoints('relation_types', 'relation_types')


@bp.route('/api/persons')
def get_persons():
    rows = query("""
        SELECT p.id, p.name, p.relation_type_id, rt.name AS relation_type
        FROM persons p
        LEFT JOIN relation_types rt ON p.relation_type_id = rt.id
        ORDER BY p.name
    """)
    return etag_json([dict(r) for r in rows])


@bp.route('/api/persons', methods=['POST'])
def create_person():
    try:
        p = PersonInput.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    try:
        new_id = execute("""
            INSERT INTO persons (name, relation_type_id)
            VALUES (%s, %s) RETURNING id
        """, (p.name, p.relation_type_id))
        return jsonify({'id': new_id, 'name': p.name}), 201
    except Exception as e:
        return db_error_response(e)


@bp.route('/api/persons/<int:pid>', methods=['PUT'])
def update_person(pid):
    try:
        p = PersonInput.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    try:
        execute("""
            UPDATE persons SET name=%s, relation_type_id=%s WHERE id=%s
        """, (p.name, p.relation_type_id, pid))
        return jsonify({'ok': True})
    except Exception as e:
        return db_error_response(e)


@bp.route('/api/persons/<int:pid>', methods=['DELETE'])
def delete_person(pid):
    try:
        execute("DELETE FROM persons WHERE id=%s", (pid,))
        return jsonify({'ok': True})
    except Exception as e:
        return db_error_response(e)
