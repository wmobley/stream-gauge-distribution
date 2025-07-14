import React from 'react';

const Header = () => {
  return (
    <header className="absolute top-0 left-1/2 -translate-x-1/2 z-[1000] mt-4 p-2 bg-white bg-opacity-80 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-gray-800">
        Flood Sensor Location Optimization Tool
      </h1>
    </header>
  );
};

export default Header;