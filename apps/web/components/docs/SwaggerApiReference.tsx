"use client";

import SwaggerUI from "swagger-ui-react";
import { NEONIX_OPENAPI } from "@/lib/docs/api-openapi";

export function SwaggerApiReference() {
  return (
    <div className="min-h-screen bg-[#f7f7f4] text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8">
        <div className="mb-6 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">Preview / API</p>
          <h1 className="text-2xl font-semibold tracking-tight">Neonix API reference</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            OpenAPI reference for the HTML-first workflow: validate HTML, compile to Protocol V2 JSON, persist projects, and create render jobs.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SwaggerUI spec={NEONIX_OPENAPI} docExpansion="list" defaultModelsExpandDepth={-1} displayRequestDuration tryItOutEnabled />
        </div>
      </div>
    </div>
  );
}
