-- Unknown prices remain NULL. This changes no existing purchase values.
ALTER TABLE "CustomerRecord" ALTER COLUMN "mrp" DROP NOT NULL;
