export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  average_speed: number; // m/s
  max_speed: number; // m/s
  start_date: string; // ISO 8601
  start_date_local: string;
  map: {
    id: string;
    summary_polyline: string | null;
    polyline?: string | null;
  };
  total_photo_count: number;
  photos?: {
    primary?: {
      urls: Record<string, string>;
    };
  };
}

export interface DecodedRoute {
  activityId: number;
  points: [number, number][]; // [lat, lng] raw
  normalized: [number, number][]; // centered + scaled for 3D
  normParams?: {
    centerLat: number;
    centerLng: number;
    cosLat: number;
    scale: number;
  };
}

export interface ActivityPhoto {
  unique_id: string;
  urls: Record<string, string>;
  caption: string;
  source: number;
}
