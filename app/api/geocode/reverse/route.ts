import { NextResponse } from "next/server";

export const runtime = "nodejs";

type NominatimResponse = {
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
  };
};

function toNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = toNumber(searchParams.get("lat"));
  const longitude = toNumber(searchParams.get("lng"));

  if (latitude === null || longitude === null) {
    return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Coordenadas fuera de rango." }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}&accept-language=es`,
      {
        headers: {
          "User-Agent": "StyleHub/1.0 (reverse-geocoding)",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json({ error: "No se pudo obtener la dirección." }, { status: 502 });
    }

    const payload = (await response.json()) as NominatimResponse;
    const address = payload.address ?? {};

    const street = [address.road, address.house_number].filter(Boolean).join(" ").trim();
    const fallbackAddress = [address.neighbourhood, address.suburb].filter(Boolean).join(", ").trim();

    return NextResponse.json({
      address: street || fallbackAddress || payload.display_name || "",
      city: address.city || address.town || address.village || "",
      state: address.state || "",
      postalCode: address.postcode || "",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo resolver la ubicación." }, { status: 500 });
  }
}
