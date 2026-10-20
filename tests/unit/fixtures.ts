// Shared inputs for the unit tests. The tags and areas stand in for what's already on file.
export const opts = { tags: ['coffee', 'matcha', 'pastries', 'restaurant', 'brunch'], areas: ['Legazpi Village', 'Poblacion'] }

// A real TikTok caption: the pin is an @account, and the next sentence follows on the same line.
export const UJISAN_CAPTION =
  "Sharing another introvert friendly-cafe in Makati where you can be productive! 📍@ujisan.matcha  I know how hard it is to find cafes that aren't overstimulating (and one where staying for a long time is ok) but I found one and the vibe is *chefs kiss* Lmk your thoughts if you decide to go 🙆🏻‍♀️ #introvertproblems"

export const UJISAN_SHORT = 'https://maps.app.goo.gl/Mv3GQ3rAtDvW4UWv8'

// What the Worker returns for that short link: the pin sits on Dela Rosa St in barangay Pio del Pilar.
export const UJISAN_PLACE = {
  url: 'https://www.google.com/maps/place/Ujisan+-+Makati/@14.5582666,121.0104817,17z/data=!3m1!4b1!4m6!3m5!1s0x3397c953f558e119:0x9503bbb072307c6d!8m2!3d14.5582666!4d121.0130566?entry=tts&skid=a',
  lat: 14.5582666,
  lng: 121.0130566,
  street: 'Dela Rosa Street',
  area: 'Pio del Pilar',
  areas: ['Kayamanan A', 'Pio del Pilar'],
  city: 'Makati',
}

export const UJISAN_ADDRESS = "Bldg 2, King's Court, 2129 Chino Roces Ave, Legaspi Village, Makati City, 1229 Metro Manila"
