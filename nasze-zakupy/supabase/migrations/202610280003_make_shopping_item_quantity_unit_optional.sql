begin;

alter table public.shopping_items
  alter column quantity drop not null,
  alter column unit drop not null;

commit;
