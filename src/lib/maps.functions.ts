import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type GeocodedAddress = {
  address: string;
  neighborhood: string | null;
  municipality: string | null;
  lat: number;
  lng: number;
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  address_components?: {
    long_name?: string;
    types?: string[];
  }[];
};

function pickComponent(result: GoogleGeocodeResult, types: string[]): string | null {
  for (const component of result.address_components ?? []) {
    if (component.long_name && types.some((t) => component.types?.includes(t))) {
      return component.long_name;
    }
  }
  return null;
}

function toAddress(result: GoogleGeocodeResult): GeocodedAddress | null {
  const lat = result.geometry?.location?.lat;
  const lng = result.geometry?.location?.lng;
  if (!result.formatted_address || typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    address: result.formatted_address,
    neighborhood: pickComponent(result, ["sublocality_level_1", "sublocality", "neighborhood"]),
    municipality: pickComponent(result, ["administrative_area_level_2", "locality"]),
    lat,
    lng,
  };
}

async function geocode(params: Record<string, string>): Promise<GeocodedAddress | null> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("A integração com o Google Maps não está configurada.");
  const query = new URLSearchParams({ language: "pt-BR", region: "br", ...params });
  const response = await fetch(`${GATEWAY_URL}/maps/api/geocode/json?${query}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
    },
  });
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as {
      error?: { details?: { reason?: string }[] };
    } | null;
    const reason = body?.error?.details?.find((d) => d.reason)?.reason;
    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
      throw new Error("A chave do Google Maps está restrita por endereço. Ajuste as restrições da chave no Google Cloud.");
    }
    if (reason === "API_KEY_SERVICE_BLOCKED") {
      throw new Error("A chave do Google Maps não permite a API de endereços. Ative a Geocoding API no Google Cloud.");
    }
    throw new Error("A consulta de endereço foi negada (403). Verifique as restrições da chave do Google Maps.");
  }
  if (!response.ok) {
    const body = await response.text();
    console.error(`Google geocode failed [${response.status}]: ${body}`);
    throw new Error("Não foi possível consultar o endereço agora.");
  }
  const data = (await response.json()) as { status?: string; results?: GoogleGeocodeResult[] };
  if (data.status !== "OK" || !data.results?.length) return null;
  return toAddress(data.results[0]);
}

export const reverseGeocodePoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  )
  .handler(async ({ data }) => {
    return geocode({ latlng: `${data.lat},${data.lng}` });
  });

export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ query: z.string().trim().min(4).max(200) }))
  .handler(async ({ data }) => {
    return geocode({ address: data.query, components: "country:BR" });
  });
