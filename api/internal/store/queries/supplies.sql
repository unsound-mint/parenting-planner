-- name: CreateSupplyItem :one
INSERT INTO supply_items (family_id, name, category, quantity, unit, low_at, per_use, size, expires_on)
VALUES (@family_id, @name, @category, @quantity, @unit, @low_at, @per_use, @size, @expires_on) RETURNING *;

-- name: ListSupplyItems :many
SELECT * FROM supply_items WHERE family_id = $1 ORDER BY created_at, id;

-- name: GetSupplyItem :one
SELECT * FROM supply_items WHERE id = @id AND family_id = @family_id;

-- name: UpdateSupplyItem :one
UPDATE supply_items SET name = @name, quantity = @quantity, unit = @unit, low_at = @low_at, per_use = @per_use, size = @size, expires_on = @expires_on
WHERE id = @id AND family_id = @family_id RETURNING *;

-- name: AddSupplyQuantity :exec
UPDATE supply_items SET quantity = GREATEST(0, quantity + @amount) WHERE id = @id AND family_id = @family_id;

-- name: DeleteSupplyItem :execrows
DELETE FROM supply_items WHERE id = @id AND family_id = @family_id;

-- name: CreateShoppingItem :one
INSERT INTO shopping_items (family_id, name, supply_item_id, restock_quantity, added_by_member_id)
VALUES (@family_id, @name, @supply_item_id, @restock_quantity, @added_by_member_id) RETURNING *;

-- Open items first, then the ones ticked in the last days.
-- name: ListShoppingItems :many
SELECT * FROM shopping_items
WHERE family_id = @family_id AND (done_at IS NULL OR done_at >= @done_since)
ORDER BY (done_at IS NOT NULL), created_at, id;

-- name: GetShoppingItemForUpdate :one
SELECT * FROM shopping_items WHERE id = @id AND family_id = @family_id FOR UPDATE;

-- name: SetShoppingItemDone :one
UPDATE shopping_items SET done_at = @done_at, done_by_member_id = @done_by
WHERE id = @id AND family_id = @family_id RETURNING *;

-- name: DeleteShoppingItem :execrows
DELETE FROM shopping_items WHERE id = @id AND family_id = @family_id;

-- name: GetOpenShoppingItemForSupply :one
SELECT * FROM shopping_items WHERE family_id = @family_id AND supply_item_id = @supply_item_id AND done_at IS NULL LIMIT 1;

-- name: SetMemberEssentialsOnly :one
UPDATE members SET essentials_only = @essentials_only WHERE id = @id AND family_id = @family_id RETURNING *;

-- name: LatestGrowthMeasurement :one
SELECT * FROM growth_measurements WHERE family_id = @family_id AND child_id = @child_id ORDER BY measured_on DESC LIMIT 1;
