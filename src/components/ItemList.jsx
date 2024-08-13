export function ItemList(props) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8  ">
      {props.items.map((item, index) => {
        return (
          <div key={index} className="flex-none cursor-pointer ">
            <a
              href={item.itemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <img
                alt="thumbnail"
                src={item.mediumImageUrls[0].imageUrl.replace(
                  "_ex=128x128",
                  "_ex=300x300"
                )}
                className="mb-5 rounded-md w-full transition-transform duration-300 group-hover:scale-105"
              />
            </a>
            <a
              href={item.itemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-blue-500 hover:underline"
            >
              {item.itemName}
            </a>
            {/* <p className="text-gray-400">By {song.artists[0].name}</p> */}
          </div>
        );
      })}
    </div>
  );
}
