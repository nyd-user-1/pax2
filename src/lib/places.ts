// Stand-in addresses for /chat's address mode while Google Places is unavailable (the key is
// denied until billing is on). Real Massachusetts addresses at their approximate coordinates;
// the district each falls in is looked up from the real district shapes, not stored here.
export const STAND_IN_PLACES: { place_id: string; description: string; lat: number; lng: number }[] = [
  { place_id: "standin-cityhall", description: "1 City Hall Sq, Boston, MA, USA", lat: 42.3603, lng: -71.058 },
  { place_id: "standin-worcester", description: "455 Main St, Worcester, MA, USA", lat: 42.2626, lng: -71.8023 },
  { place_id: "standin-hyannis", description: "367 Main St, Hyannis, MA, USA", lat: 41.6526, lng: -70.2881 },
  { place_id: "standin-springfield", description: "36 Court St, Springfield, MA, USA", lat: 42.1015, lng: -72.5898 },
  { place_id: "standin-lowell", description: "375 Merrimack St, Lowell, MA, USA", lat: 42.6459, lng: -71.311 },
  { place_id: "standin-newbedford", description: "133 William St, New Bedford, MA, USA", lat: 41.6362, lng: -70.9259 },
  { place_id: "standin-pittsfield", description: "70 Allen St, Pittsfield, MA, USA", lat: 42.4501, lng: -73.2545 },
  { place_id: "standin-northampton", description: "210 Main St, Northampton, MA, USA", lat: 42.3188, lng: -72.6315 },
  { place_id: "standin-cambridge", description: "795 Massachusetts Ave, Cambridge, MA, USA", lat: 42.3671, lng: -71.1056 },
  { place_id: "standin-quincy", description: "1305 Hancock St, Quincy, MA, USA", lat: 42.2509, lng: -71.0024 },
  { place_id: "standin-denver", description: "1437 Bannock St, Denver, CO, USA", lat: 39.7392, lng: -104.9903 },
  { place_id: "standin-cosprings", description: "107 N Nevada Ave, Colorado Springs, CO, USA", lat: 38.8353, lng: -104.8221 },
  { place_id: "standin-boulder", description: "1777 Broadway, Boulder, CO, USA", lat: 40.015, lng: -105.2798 },
  { place_id: "standin-fortcollins", description: "300 Laporte Ave, Fort Collins, CO, USA", lat: 40.5888, lng: -105.079 },
  { place_id: "standin-pueblo", description: "1 City Hall Pl, Pueblo, CO, USA", lat: 38.2669, lng: -104.6089 },
  { place_id: "standin-grandjunction", description: "250 N 5th St, Grand Junction, CO, USA", lat: 39.0688, lng: -108.5653 },
  { place_id: "standin-aurora", description: "15151 E Alameda Pkwy, Aurora, CO, USA", lat: 39.7104, lng: -104.8118 },
]

/** What the list shows when nothing typed matches: both states. */
export const STAND_IN_DEFAULT = ["standin-cityhall", "standin-worcester", "standin-hyannis", "standin-denver", "standin-cosprings"]

export const googleKey = () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
