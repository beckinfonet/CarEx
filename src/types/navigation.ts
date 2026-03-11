export type RootStackParamList = {
  Home: { clearFilters?: boolean } | undefined;
  CarDetails: { carId: string; carData?: any };
  SellCar: { carId?: string } | undefined;
  About: undefined;
  Login: undefined;
  Signup: undefined;
  Profile: undefined;
  Favorites: undefined;
  MyListings: undefined;
};
